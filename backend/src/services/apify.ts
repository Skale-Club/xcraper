import { ApifyClient } from 'apify-client';
import type { ActorStartOptions, WebhookEventType } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_API_TOKEN) {
    console.warn('Warning: APIFY_API_TOKEN is not set. Scraping functionality will not work.');
}

export const apifyClient = APIFY_API_TOKEN
    ? new ApifyClient({ token: APIFY_API_TOKEN })
    : null;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds
const APIFY_MIN_RUN_CHARGE_USD = 0.5;

type ActorType = 'standard' | 'enriched';

interface ActorConfig {
    type: ActorType;
    id: string;
    name: string;
    extractsEmails: boolean;
    costPerResultUsd: number;
    fixedStartCostUsd: number;
    creditsPerResult: number;
    buildInput: (params: Required<Pick<SearchParams, 'search' | 'location' | 'maxResults' | 'language' | 'countryCode'>>) => Record<string, unknown>;
    buildStartOptions: (params: Required<Pick<SearchParams, 'maxResults'>>) => ActorStartOptions;
}

const baseSearchInput = (params: Required<Pick<SearchParams, 'search' | 'location' | 'maxResults' | 'language' | 'countryCode'>>) => ({
    searchStringsArray: [params.search.trim()],
    locationQuery: params.location.trim(),
    countryCode: params.countryCode,
    language: params.language,
    maxCrawledPlacesPerSearch: params.maxResults,
    maxImages: 0, // 0 para não consumir recursos extras
    maxReviews: 0,
    skipClosedPlaces: false,
    proxyConfig: {
        useApifyProxy: true,
    },
});

const ACTOR_CONFIGS: Record<ActorType, ActorConfig> = {
    standard: {
        type: 'standard',
        id: 'nwua9Gu5YrADL7ZDj',
        name: 'Google Maps Scraper (Standard)',
        extractsEmails: false,
        costPerResultUsd: 0.004,
        fixedStartCostUsd: 0.007,
        creditsPerResult: 1,
        buildInput: (params) => ({
            ...baseSearchInput(params),
        }),
        buildStartOptions: (params) => ({
            memory: 2048, // Use 2GB de memória (mínimo necessário)
            maxTotalChargeUsd: Number(Math.max(
                APIFY_MIN_RUN_CHARGE_USD,
                0.02 + 0.007 + (params.maxResults * 0.004),
            ).toFixed(3)),
        }),
    },
    enriched: {
        type: 'enriched',
        id: 'WnMxbsRLNbPeYL6ge',
        name: 'Google Maps Email Extractor (Enriched)',
        extractsEmails: true,
        costPerResultUsd: 0.009,
        fixedStartCostUsd: 0,
        creditsPerResult: 3,
        buildInput: (params) => ({
            searchStringsArray: [params.search.trim()],
            locationQuery: params.location.trim(),
            countryCode: params.countryCode,
            language: params.language,
            maxCrawledPlacesPerSearch: params.maxResults,
            skipClosedPlaces: false,
        }),
        buildStartOptions: (params) => ({
            memory: 2048, // Use 2GB de memória (mínimo necessário)
            maxTotalChargeUsd: Number(Math.max(
                APIFY_MIN_RUN_CHARGE_USD,
                0.02 + (params.maxResults * 0.009),
            ).toFixed(3)),
        }),
    },
};

export interface SearchParams {
    search: string;
    location: string;
    maxResults?: number;
    language?: string;
    countryCode?: string;
    extractEmails?: boolean;
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

function getConfig(extractEmails: boolean): ActorConfig {
    return extractEmails ? ACTOR_CONFIGS.enriched : ACTOR_CONFIGS.standard;
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

function getItemsCountFromRun(run: Record<string, unknown>): number {
    const stats = run.stats as Record<string, unknown> | undefined;

    return typeof stats?.itemsOutputted === 'number'
        ? stats.itemsOutputted
        : typeof stats?.outputItems === 'number'
            ? stats.outputItems
            : 0;
}

/**
 * Retry helper function with exponential backoff
 */
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

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));

        return retryWithBackoff(fn, retries - 1, delay * 2);
    }
}

export async function startScrapingTask(params: SearchParams): Promise<StartedTask> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    const normalizedParams = normalizeSearchParams(params);
    const config = getConfig(Boolean(params.extractEmails));
    const input = config.buildInput(normalizedParams);
    const baseStartOptions = config.buildStartOptions({ maxResults: normalizedParams.maxResults });

    // Configure webhook for real-time notifications
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const webhookUrl = `${backendUrl}/api/webhooks/apify`;

    const webhookEventTypes: WebhookEventType[] = [
        'ACTOR.RUN.SUCCEEDED',
        'ACTOR.RUN.FAILED',
        'ACTOR.RUN.ABORTED',
        'ACTOR.RUN.TIMED_OUT',
    ];

    const startOptions: ActorStartOptions = {
        ...baseStartOptions,
        // Remover webhooks por enquanto - eles serão configurados separadamente
    };

    try {
        // Use retry logic for starting the actor
        const run = await retryWithBackoff(async () => {
            return await apifyClient!.actor(config.id).start(input, startOptions);
        });

        console.log(`✅ Started ${config.name} - Run ID: ${run.id}`);
        console.log(`   Actor: ${config.id}`);
        console.log(`   Email extraction: ${config.extractsEmails ? 'YES' : 'NO'}`);
        console.log(`   Requested max results: ${normalizedParams.maxResults}`);
        console.log(`   Webhook URL: ${webhookUrl}`);

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
        // Use retry logic for fetching results
        const { items } = await retryWithBackoff(async () => {
            return await apifyClient!.run(runId).dataset().listItems();
        });

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

export function getActorConfig(extractEmails: boolean) {
    return getConfig(extractEmails);
}
