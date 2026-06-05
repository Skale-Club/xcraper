import type { ActorStartOptions } from 'apify-client';
import type {
    ScraperTemplate,
    ScraperSearchParams,
    ScraperRuntimeParams,
    ScraperGlobalConfig,
} from '../types.js';
import { computeResultChargeCeiling, mapGooglePlace } from '../helpers.js';

/**
 * Standard Google Maps scraper — business listings (no email extraction).
 * Actor: compass/crawler-google-places style.
 */
export const standardTemplate: ScraperTemplate = {
    key: 'standard',
    source: 'google_maps',
    contactType: 'place',
    label: 'Google Maps — Standard',
    description: 'Business listings from Google Maps: name, phone, website, address, ratings and social links.',
    billing: 'pay_per_result',
    extractsEmails: false,

    inputSchema: [
        { key: 'query', type: 'text', label: 'What to search', placeholder: 'e.g. dentists, plumbers, law firms', required: true },
        { key: 'location', type: 'text', label: 'Location', placeholder: 'e.g. New York, United States', required: true },
    ],

    defaults: {
        actorId: 'nwua9Gu5YrADL7ZDj',
        actorName: 'Google Maps Scraper (Standard)',
        costPerResultUsd: 0.004,
        fixedStartCostUsd: 0.007,
        memoryMb: 2048,
        creditsPerResult: 1,
        minResults: 30,
        maxResults: 500,
        isActive: true,
    },

    buildInput(params: ScraperSearchParams): Record<string, unknown> {
        return {
            searchStringsArray: [(params.query ?? '').trim()],
            locationQuery: (params.location ?? '').trim(),
            countryCode: params.countryCode,
            language: params.language,
            maxCrawledPlacesPerSearch: params.maxResults,
            maxImages: 0,
            maxReviews: 0,
            skipClosedPlaces: false,
            proxyConfig: {
                useApifyProxy: true,
            },
        };
    },

    buildStartOptions(
        params: ScraperSearchParams,
        runtime: ScraperRuntimeParams,
        global: ScraperGlobalConfig,
    ): ActorStartOptions {
        return {
            memory: runtime.memoryMb,
            maxTotalChargeUsd: computeResultChargeCeiling(runtime, global, params.maxResults),
        };
    },

    mapResult: mapGooglePlace,

    dedupeKey(contact) {
        return contact.placeId || undefined;
    },
};
