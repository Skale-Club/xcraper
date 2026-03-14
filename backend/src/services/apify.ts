import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config();

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_API_TOKEN) {
    console.warn('Warning: APIFY_API_TOKEN is not set. Scraping functionality will not work.');
}

// Initialize Apify client
export const apifyClient = APIFY_API_TOKEN
    ? new ApifyClient({ token: APIFY_API_TOKEN })
    : null;

// Google Maps Scraper Actor ID (using a popular community actor)
const GOOGLE_MAPS_ACTOR_ID = 'compass/google-maps-scraper';

export interface SearchParams {
    search: string;
    location: string;
    maxResults?: number;
    language?: string;
    countryCode?: string;
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
    rawData?: Record<string, unknown>;
}

// Start a scraping task
export async function startScrapingTask(params: SearchParams): Promise<string> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    const searchString = `${params.search} ${params.location}`.trim();

    const input = {
        searchStringsArray: [searchString],
        maxItems: params.maxResults || 50,
        language: params.language || 'en',
        countryCode: params.countryCode || 'us',
        extractEmails: true,
        extractPhones: true,
        extractWebsites: true,
        extractAddress: true,
        extractCoordinates: true,
        extractOpeningHours: true,
        extractReviews: false,
        maxReview: 0,
        zoom: 15,
        deeperCityScrape: false,
        placeMinimumStars: '',
        skipClosedPlaces: false,
        allPlaceCategories: false,
        isMapsURL: false,
    };

    try {
        const run = await apifyClient.actor(GOOGLE_MAPS_ACTOR_ID).call(input);
        return run.id;
    } catch (error) {
        console.error('Error starting Apify task:', error);
        throw new Error(`Failed to start scraping task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Get the status of a scraping task
export async function getTaskStatus(runId: string): Promise<{
    status: string;
    progress: number;
    itemsCount: number;
}> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    try {
        const run = await apifyClient.run(runId).get();

        if (!run) {
            throw new Error('Run not found');
        }

        const stats = run.stats as unknown as Record<string, unknown> | undefined;
        const itemsCount =
            typeof stats?.itemsOutputted === 'number'
                ? stats.itemsOutputted
                : typeof stats?.outputItems === 'number'
                    ? stats.outputItems
                    : 0;

        return {
            status: run.status,
            progress: run.status === 'SUCCEEDED' ? 100 : run.status === 'RUNNING' ? 50 : 0,
            itemsCount,
        };
    } catch (error) {
        console.error('Error getting task status:', error);
        throw new Error(`Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Get the results of a completed scraping task
export async function getTaskResults(runId: string): Promise<ScrapedPlace[]> {
    if (!apifyClient) {
        throw new Error('Apify client is not initialized. Please set APIFY_API_TOKEN.');
    }

    try {
        const { items } = await apifyClient.run(runId).dataset().listItems();

        return items.map((item: Record<string, unknown>) => {
            const location =
                typeof item.location === 'object' && item.location !== null
                    ? (item.location as { lat?: unknown; lng?: unknown })
                    : undefined;

            return {
                title: String(item.title || item.name || ''),
                category: String(item.categoryName || item.category || ''),
                address: String(item.address || ''),
                phone: item.phone ? String(item.phone) : undefined,
                website: item.website ? String(item.website) : undefined,
                email: item.email ? String(item.email) : undefined,
                rating: typeof item.totalScore === 'number' ? item.totalScore : undefined,
                reviewCount: typeof item.reviewsCount === 'number' ? item.reviewsCount : undefined,
                latitude: typeof location?.lat === 'number' ? location.lat : undefined,
                longitude: typeof location?.lng === 'number' ? location.lng : undefined,
                openingHours: item.hours ? JSON.stringify(item.hours) : undefined,
                imageUrl: item.image ? String(item.image) : undefined,
                googleMapsUrl: item.url ? String(item.url) : undefined,
                rawData: item,
            };
        });
    } catch (error) {
        console.error('Error getting task results:', error);
        throw new Error(`Failed to get task results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Check if Apify is configured
export function isApifyConfigured(): boolean {
    return apifyClient !== null;
}
