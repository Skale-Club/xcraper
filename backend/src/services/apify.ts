import { ApifyClient } from 'apify-client';
import type { ActorStartOptions } from 'apify-client';
import * as dotenv from 'dotenv';
import { scraperRegistry } from './scrapers/registry.js';
import type { ScraperSearchParams, NormalizedContact } from './scrapers/types.js';

dotenv.config();

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN?.trim();

if (!APIFY_API_TOKEN) {
    console.warn('Warning: APIFY_API_TOKEN is not set. Scraping functionality will not work.');
}

export const apifyClient = APIFY_API_TOKEN
    ? new ApifyClient({ token: APIFY_API_TOKEN })
    : null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Re-exported so existing consumers can import the unified result shape from here.
export type { NormalizedContact, ScraperSearchParams } from './scrapers/types.js';

export interface StartedTask {
    runId: string;
    actorId: string;
    actorName: string;
    scraperKey: string;
    input: Record<string, unknown>;
    startOptions: ActorStartOptions;
    datasetId?: string;
    containerUrl?: string;
    startedAt?: Date;
    status?: string;
    usageTotalUsd?: number;
    statusMessage?: string;
}

export interface TaskStatus {
    status: string;
    progress: number;
    itemsCount: number;
    datasetId?: string;
    containerUrl?: string;
    usageTotalUsd?: number;
    statusMessage?: string;
    exitCode?: string | number;
    startedAt?: Date;
    finishedAt?: Date;
}

function getItemsCountFromRun(run: Record<string, unknown>): number {
    const stats = run.stats as Record<string, unknown> | undefined;

    return typeof stats?.itemsOutputted === 'number'
        ? stats.itemsOutputted
        : typeof stats?.outputItems === 'number'
            ? stats.outputItems
            : 0;
}

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = MAX_RETRIES,
    delay: number = RETRY_DELAY_MS
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) {
            throw error;
        }

        console.warn(`Retry attempt ${MAX_RETRIES - retries + 1}/${MAX_RETRIES} after error:`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return retryWithBackoff(fn, retries - 1, delay * 2);
    }
}

/**
 * Start a scraping run for the given template key. Resolves the template (logic +
 * DB params + global economics) from the registry, builds the actor input and start
 * options from the template, and starts the actor asynchronously.
 *
 * Starting an actor is NOT idempotent: retrying an ambiguous failure (e.g. a dropped
 * response after the run was actually created) would spawn a second paid run. So we
 * deliberately do not wrap start() in retryWithBackoff — a transient failure surfaces
 * to the caller, who can retry explicitly.
 */
export async function startScrapingTask(scraperKey: string, params: ScraperSearchParams): Promise<StartedTask> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    const { template, runtime, global } = await scraperRegistry.resolve(scraperKey);

    const requestedMax = params.maxResults || runtime.maxResults || 50;
    const normalized: ScraperSearchParams = {
        ...params,
        // Cap at the template's max (enforces e.g. the Apify free-plan 100-lead ceiling).
        maxResults: Math.min(requestedMax, runtime.maxResults),
        language: params.language || global.defaultSearchLanguage || 'en',
        countryCode: (params.countryCode || global.defaultSearchCountryCode || 'us').toLowerCase(),
    };

    const input = template.buildInput(normalized, runtime);
    const startOptions = template.buildStartOptions(normalized, runtime, global);

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const webhookUrl = `${backendUrl}/api/webhooks/apify`;

    try {
        const run = await apifyClient.actor(runtime.actorId).start(input, startOptions);

        console.log(`Started ${runtime.actorName} [${template.key}] - Run ID: ${run.id}`);
        console.log(`Actor: ${runtime.actorId}`);
        console.log(`Email extraction: ${template.extractsEmails ? 'YES' : 'NO'}`);
        console.log(`Requested max results: ${normalized.maxResults}`);
        console.log(`Webhook URL: ${webhookUrl}`);

        return {
            runId: run.id,
            actorId: runtime.actorId,
            actorName: runtime.actorName,
            scraperKey: template.key,
            input,
            startOptions,
            datasetId: run.defaultDatasetId,
            containerUrl: run.containerUrl,
            startedAt: run.startedAt,
            status: run.status,
            usageTotalUsd: run.usageTotalUsd,
            statusMessage: run.statusMessage,
        };
    } catch (error) {
        console.error('Error starting Apify task:', error);
        throw new Error(`Failed to start scraping task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function getTaskStatus(runId: string): Promise<TaskStatus> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    try {
        const run = await apifyClient.run(runId).get();
        const runRecord = run as unknown as Record<string, unknown>;

        if (!run) {
            throw new Error('Run not found');
        }

        return {
            status: run.status,
            progress: run.status === 'SUCCEEDED'
                ? 100
                : run.status === 'RUNNING'
                    ? 50
                    : run.status === 'READY'
                        ? 10
                        : run.status === 'ABORTING'
                            ? 80
                            : 0,
            itemsCount: getItemsCountFromRun(run as unknown as Record<string, unknown>),
            datasetId: run.defaultDatasetId,
            containerUrl: run.containerUrl,
            usageTotalUsd: run.usageTotalUsd,
            statusMessage: run.statusMessage,
            exitCode: typeof runRecord.exitCode === 'string' || typeof runRecord.exitCode === 'number'
                ? runRecord.exitCode
                : undefined,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
        };
    } catch (error) {
        console.error('Error getting task status:', error);
        throw new Error(`Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function abortTask(runId: string): Promise<void> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    try {
        await apifyClient.run(runId).abort({ gracefully: true });
    } catch (error) {
        console.error('Error aborting task:', error);
        throw new Error(`Failed to abort task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Fetch and normalize the dataset items for a run, using the template's mapResult.
 * Only fetches as many items as the caller will keep (avoids materializing huge
 * datasets with full rawData blobs into memory).
 */
export async function getTaskResults(
    runId: string,
    scraperKey: string,
    limit?: number,
): Promise<NormalizedContact[]> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    const template = scraperRegistry.getTemplate(scraperKey);
    if (!template) {
        throw new Error(`Unknown scraper template: "${scraperKey}"`);
    }

    try {
        const listOptions = limit && limit > 0 ? { limit } : undefined;
        const { items } = await retryWithBackoff(async () => apifyClient.run(runId).dataset().listItems(listOptions));

        return items.map((item: Record<string, unknown>) => {
            const contact = template.mapResult(item);
            return { ...contact, dedupeKey: template.dedupeKey(contact) };
        });
    } catch (error) {
        console.error('Error getting task results:', error);
        throw new Error(`Failed to get task results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function isApifyConfigured(): boolean {
    return apifyClient !== null;
}
