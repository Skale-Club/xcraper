import {
    startScrapingTask as startApifyTask,
    getTaskStatus as getApifyTaskStatus,
    getTaskResults as getApifyTaskResults,
    abortTask as abortApifyTask,
    isApifyConfigured,
    type StartedTask,
    type TaskStatus,
} from './apify.js';
import {
    HomelabError,
    downloadHomelabCsv,
    getHomelabConfig,
    getHomelabJobStatus,
    isHomelabConfigured,
    parseHomelabCsv,
    startHomelabJob,
    HOMELAB_NOT_CONFIGURED_MESSAGE,
} from './homelab.js';
import { scraperRegistry } from './scrapers/registry.js';
import type { NormalizedContact, ScraperProvider, ScraperSearchParams } from './scrapers/types.js';

/**
 * Provider seam. A scraper template runs on either Apify (the original path, behaviour
 * unchanged: these functions delegate to services/apify.ts verbatim) or the owner's
 * homelab engine (services/homelab.ts). Callers (routes/search.ts, routes/service.ts,
 * routes/sse.ts) go through here and pass the stored `scrapeType`, from which the
 * provider is derived; the persisted job id lives in `search_history.apify_run_id`
 * for both providers, so no schema change is needed.
 */

export type { StartedTask, TaskStatus };

export function getScraperProvider(scraperKey: string): ScraperProvider {
    return scraperRegistry.getTemplate(scraperKey)?.provider ?? 'apify';
}

export function isHomelabScraper(scraperKey: string): boolean {
    return getScraperProvider(scraperKey) === 'homelab';
}

export function isScraperProviderConfigured(scraperKey: string): boolean {
    return isHomelabScraper(scraperKey) ? isHomelabConfigured() : isApifyConfigured();
}

export function providerNotConfiguredMessage(scraperKey: string): string {
    return isHomelabScraper(scraperKey)
        ? HOMELAB_NOT_CONFIGURED_MESSAGE
        : 'Scraping service is not configured. Please contact administrator.';
}

async function startHomelabTask(scraperKey: string, params: ScraperSearchParams): Promise<StartedTask> {
    if (!getHomelabConfig()) {
        throw new HomelabError(HOMELAB_NOT_CONFIGURED_MESSAGE, 'not_configured');
    }

    const { template, runtime, global } = await scraperRegistry.resolve(scraperKey);
    const normalized: ScraperSearchParams = {
        ...params,
        maxResults: Math.min(params.maxResults || runtime.maxResults, runtime.maxResults),
        language: params.language || global.defaultSearchLanguage || 'en',
        countryCode: (params.countryCode || global.defaultSearchCountryCode || 'us').toLowerCase(),
    };

    const input = template.buildInput(normalized, runtime);
    const { id } = await startHomelabJob(input);
    console.log(`Started ${runtime.actorName} [${template.key}] - Homelab job ID: ${id}`);

    return {
        runId: id,
        actorId: runtime.actorId,
        actorName: runtime.actorName,
        scraperKey: template.key,
        input,
        startOptions: {},
        startedAt: new Date(),
        status: 'READY',
    };
}

async function getHomelabResults(
    jobId: string,
    scraperKey: string,
    limit?: number,
): Promise<NormalizedContact[]> {
    const template = scraperRegistry.getTemplate(scraperKey);
    if (!template) {
        throw new Error(`Unknown scraper template: "${scraperKey}"`);
    }

    const rows = parseHomelabCsv(await downloadHomelabCsv(jobId));
    const contacts = rows
        .map((row) => template.mapResult(row))
        .filter((contact) => contact.title.length > 0)
        .map((contact) => ({ ...contact, dedupeKey: template.dedupeKey(contact) }));

    return limit && limit > 0 ? contacts.slice(0, limit) : contacts;
}

export async function startScrapingTask(scraperKey: string, params: ScraperSearchParams): Promise<StartedTask> {
    return isHomelabScraper(scraperKey)
        ? startHomelabTask(scraperKey, params)
        : startApifyTask(scraperKey, params);
}

export async function getTaskStatus(runId: string, scraperKey: string): Promise<TaskStatus> {
    return isHomelabScraper(scraperKey)
        ? getHomelabJobStatus(runId)
        : getApifyTaskStatus(runId);
}

export async function getTaskResults(
    runId: string,
    scraperKey: string,
    limit?: number,
): Promise<NormalizedContact[]> {
    return isHomelabScraper(scraperKey)
        ? getHomelabResults(runId, scraperKey, limit)
        : getApifyTaskResults(runId, scraperKey, limit);
}

export async function abortTask(runId: string, scraperKey: string): Promise<void> {
    if (isHomelabScraper(scraperKey)) {
        throw new HomelabError(
            'A homelab search cannot be paused; wait for the job to finish.',
            'unsupported',
        );
    }
    return abortApifyTask(runId);
}
