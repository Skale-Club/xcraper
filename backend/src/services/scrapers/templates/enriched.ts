import type { ActorStartOptions } from 'apify-client';
import type {
    ScraperTemplate,
    ScraperSearchParams,
    ScraperRuntimeParams,
    ScraperGlobalConfig,
} from '../types.js';
import { computeResultChargeCeiling, mapGooglePlace } from '../helpers.js';

/**
 * Enriched Google Maps scraper — same listings as standard, plus email extraction.
 * Actor: Google Maps email extractor style. Input omits proxyConfig/maxImages/maxReviews
 * (different input schema than the standard actor).
 */
export const enrichedTemplate: ScraperTemplate = {
    key: 'enriched',
    source: 'google_maps',
    contactType: 'place',
    label: 'Google Maps — Enriched (emails)',
    description: 'Everything in Standard plus extracted email addresses for outreach-ready leads.',
    billing: 'pay_per_result',
    extractsEmails: true,

    inputSchema: [
        { key: 'query', type: 'text', label: 'What to search', placeholder: 'e.g. marketing agencies', required: true },
        { key: 'location', type: 'text', label: 'Location', placeholder: 'e.g. London, United Kingdom', required: true },
    ],

    defaults: {
        actorId: 'WnMxbsRLNbPeYL6ge',
        actorName: 'Google Maps Email Extractor (Enriched)',
        costPerResultUsd: 0.009,
        fixedStartCostUsd: 0,
        memoryMb: 2048,
        creditsPerResult: 3,
        minResults: 15,
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
            skipClosedPlaces: false,
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
