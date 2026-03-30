import { ApifyClient } from 'apify-client';
import type { ActorStartOptions } from 'apify-client';
import * as dotenv from 'dotenv';
import { systemSettingsService } from './systemSettings.js';

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

type ActorType = 'standard' | 'enriched';

export interface SearchParams {
    search: string;
    location: string;
    maxResults?: number;
    language?: string;
    countryCode?: string;
    extractEmails?: boolean;
}

interface ActorConfig {
    type: ActorType;
    id: string;
    name: string;
    extractsEmails: boolean;
    costPerResultUsd: number;
    fixedStartCostUsd: number;
    memoryMb: number;
    baseRunCostUsd: number;
    minRunChargeUsd: number;
    buildInput: (params: Required<Pick<SearchParams, 'search' | 'location' | 'maxResults' | 'language' | 'countryCode'>>) => Record<string, unknown>;
    buildStartOptions: (params: Required<Pick<SearchParams, 'maxResults'>>) => ActorStartOptions;
}

export interface StartedTask {
    runId: string;
    actorId: string;
    actorName: string;
    actorType: ActorType;
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

export interface ScrapedPlace {
    title: string;
    category: string;
    address: string;
    phone?: string;
    website?: string;
    email?: string;
    rating?: number;
    reviewCount?: number;
    latitude?: number;
    longitude?: number;
    openingHours?: string;
    imageUrl?: string;
    googleMapsUrl?: string;
    placeId?: string;
    rawData?: Record<string, unknown>;
    [key: string]: unknown;
}

const baseSearchInput = (params: Required<Pick<SearchParams, 'search' | 'location' | 'maxResults' | 'language' | 'countryCode'>>) => ({
    searchStringsArray: [params.search.trim()],
    locationQuery: params.location.trim(),
    countryCode: params.countryCode,
    language: params.language,
    maxCrawledPlacesPerSearch: params.maxResults,
    maxImages: 0,
    maxReviews: 0,
    skipClosedPlaces: false,
    proxyConfig: {
        useApifyProxy: true,
    },
});

function buildStartOptions(config: Pick<ActorConfig, 'memoryMb' | 'baseRunCostUsd' | 'fixedStartCostUsd' | 'costPerResultUsd' | 'minRunChargeUsd'>, params: Required<Pick<SearchParams, 'maxResults'>>): ActorStartOptions {
    return {
        memory: config.memoryMb,
        maxTotalChargeUsd: Number(Math.max(
            config.minRunChargeUsd,
            config.baseRunCostUsd + config.fixedStartCostUsd + (params.maxResults * config.costPerResultUsd),
        ).toFixed(3)),
    };
}

function getFirstString(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            if (typeof item === 'string') {
                const trimmed = item.trim();
                if (trimmed.length > 0) {
                    return trimmed;
                }
            }
        }
    }

    return undefined;
}

function normalizeSearchParams(params: SearchParams): Required<Pick<SearchParams, 'search' | 'location' | 'maxResults' | 'language' | 'countryCode'>> {
    return {
        search: params.search.trim(),
        location: params.location.trim(),
        maxResults: params.maxResults || 50,
        language: params.language || 'en',
        countryCode: params.countryCode?.toLowerCase() || 'us',
    };
}

async function getConfig(extractEmails: boolean): Promise<ActorConfig> {
    const apifyConfig = await systemSettingsService.getApifyConfig();
    const actorConfig = extractEmails ? apifyConfig.enriched : apifyConfig.standard;
    const type: ActorType = extractEmails ? 'enriched' : 'standard';

    return {
        type,
        id: actorConfig.actorId,
        name: actorConfig.actorName,
        extractsEmails: extractEmails,
        costPerResultUsd: actorConfig.costPerResultUsd,
        fixedStartCostUsd: actorConfig.fixedStartCostUsd,
        memoryMb: actorConfig.memoryMb,
        baseRunCostUsd: apifyConfig.baseRunCostUsd,
        minRunChargeUsd: apifyConfig.minRunChargeUsd,
        buildInput: type === 'standard'
            ? (params) => ({
                ...baseSearchInput(params),
            })
            : (params) => ({
                searchStringsArray: [params.search.trim()],
                locationQuery: params.location.trim(),
                countryCode: params.countryCode,
                language: params.language,
                maxCrawledPlacesPerSearch: params.maxResults,
                skipClosedPlaces: false,
            }),
        buildStartOptions: (params) => buildStartOptions({
            memoryMb: actorConfig.memoryMb,
            baseRunCostUsd: apifyConfig.baseRunCostUsd,
            fixedStartCostUsd: actorConfig.fixedStartCostUsd,
            costPerResultUsd: actorConfig.costPerResultUsd,
            minRunChargeUsd: apifyConfig.minRunChargeUsd,
        }, params),
    };
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

export async function startScrapingTask(params: SearchParams): Promise<StartedTask> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    const apifyDefaults = await systemSettingsService.getApifyConfig();
    const normalizedParams = normalizeSearchParams({
        ...params,
        language: params.language || apifyDefaults.defaultSearchLanguage,
        countryCode: params.countryCode || apifyDefaults.defaultSearchCountryCode,
    });
    const config = await getConfig(Boolean(params.extractEmails));
    const input = config.buildInput(normalizedParams);
    const startOptions = config.buildStartOptions({ maxResults: normalizedParams.maxResults });

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const webhookUrl = `${backendUrl}/api/webhooks/apify`;

    try {
        const run = await retryWithBackoff(async () => apifyClient.actor(config.id).start(input, startOptions));

        console.log(`Started ${config.name} - Run ID: ${run.id}`);
        console.log(`Actor: ${config.id}`);
        console.log(`Email extraction: ${config.extractsEmails ? 'YES' : 'NO'}`);
        console.log(`Requested max results: ${normalizedParams.maxResults}`);
        console.log(`Webhook URL: ${webhookUrl}`);

        return {
            runId: run.id,
            actorId: config.id,
            actorName: config.name,
            actorType: config.type,
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

export async function getTaskResults(runId: string): Promise<ScrapedPlace[]> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    try {
        const { items } = await retryWithBackoff(async () => apifyClient.run(runId).dataset().listItems());

        return items.map((item: Record<string, unknown>) => {
            const location =
                typeof item.location === 'object' && item.location !== null
                    ? (item.location as { lat?: unknown; lng?: unknown })
                    : undefined;

            const lat = typeof location?.lat === 'number'
                ? location.lat
                : typeof item.latitude === 'number'
                    ? item.latitude
                    : undefined;

            const lng = typeof location?.lng === 'number'
                ? location.lng
                : typeof item.longitude === 'number'
                    ? item.longitude
                    : undefined;

            return {
                title: String(item.title || item.name || ''),
                category: String(item.categoryName || item.category || ''),
                address: String(item.address || ''),
                phone: getFirstString(item.phone) || getFirstString(item.phoneNumber) || getFirstString(item.phones),
                website: item.website || item.url ? String(item.website || item.url) : undefined,
                email: getFirstString(item.email) || getFirstString(item.emails),
                rating: typeof item.totalScore === 'number'
                    ? item.totalScore
                    : typeof item.rating === 'number'
                        ? item.rating
                        : undefined,
                reviewCount: typeof item.reviewsCount === 'number'
                    ? item.reviewsCount
                    : typeof item.reviews === 'number'
                        ? item.reviews
                        : undefined,
                latitude: lat,
                longitude: lng,
                openingHours: item.hours
                    ? JSON.stringify(item.hours)
                    : item.openingHours
                        ? String(item.openingHours)
                        : undefined,
                imageUrl: item.image || item.imageUrl ? String(item.image || item.imageUrl) : undefined,
                googleMapsUrl: item.url || item.googleMapsUrl ? String(item.url || item.googleMapsUrl) : undefined,
                placeId: item.placeId ? String(item.placeId) : undefined,
                rawData: item,
            };
        });
    } catch (error) {
        console.error('Error getting task results:', error);
        throw new Error(`Failed to get task results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function isApifyConfigured(): boolean {
    return apifyClient !== null;
}

export async function getActorConfig(extractEmails: boolean) {
    return getConfig(extractEmails);
}
