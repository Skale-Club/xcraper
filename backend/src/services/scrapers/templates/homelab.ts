import type { ActorStartOptions } from 'apify-client';
import type { NormalizedContact, ScraperTemplate, ScraperSearchParams } from '../types.js';
import { getFirstString, getNumber } from '../helpers.js';
import { resolveContactEmail } from '../../emailPlaceholders.js';
import { getHomelabJobSettings } from '../../homelab.js';

/**
 * Google Maps via the owner's homelab (`gosom/google-maps-scraper`, web/API mode).
 *
 * Owner-only (SUPER_ADMIN_EMAIL) and free of credits: it runs on the owner's own
 * hardware, one job at a time. The job runs on provider `homelab`, not Apify — see
 * services/scrapeProvider.ts. The `actorId` default is only a display label.
 */

export const HOMELAB_SCRAPER_KEY = 'homelab';

function jsonObject(value: string | undefined): Record<string, unknown> | undefined {
    if (!value) return undefined;
    try {
        const parsed: unknown = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

/**
 * The engine serializes the `emails` column as a list; depending on version and
 * writer that is a JSON array, or addresses joined by commas/semicolons/spaces.
 * Accept all of them and keep only things that look like an address.
 */
export function parseHomelabEmails(value: unknown): string[] {
    const found: string[] = [];
    const push = (candidate: unknown) => {
        if (typeof candidate !== 'string') return;
        const trimmed = candidate.trim().replace(/^["']+|["']+$/g, '');
        if (/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(trimmed)) found.push(trimmed);
    };

    if (Array.isArray(value)) {
        value.forEach(push);
    } else if (typeof value === 'string') {
        const text = value.trim();
        if (text.startsWith('[')) {
            try {
                const parsed: unknown = JSON.parse(text);
                if (Array.isArray(parsed)) parsed.forEach(push);
            } catch {
                text.split(/[\s,;|[\]]+/).forEach(push);
            }
        } else {
            text.split(/[\s,;|]+/).forEach(push);
        }
    }

    const seen = new Set<string>();
    return found.filter((e) => {
        const key = e.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function str(row: Record<string, unknown>, key: string): string | undefined {
    return getFirstString(row[key]);
}

/** CSV cells are strings and an empty cell means "unknown", not 0 (getNumber('') is 0). */
function numeric(row: Record<string, unknown>, key: string): number | undefined {
    const text = str(row, key);
    return text === undefined ? undefined : getNumber(text);
}

/** Map one row of the engine's CSV (already keyed by header) into the unified shape. */
export function mapHomelabPlace(row: Record<string, unknown>): NormalizedContact {
    const completeAddress = jsonObject(str(row, 'complete_address'));
    const part = (key: string) => getFirstString(completeAddress?.[key]);

    const street = part('street');
    const city = part('city');
    const state = part('state');
    const postalCode = part('postal_code') ?? part('postalCode') ?? part('zip');
    const country = part('country');

    const composed = [street, city, [state, postalCode].filter(Boolean).join(' ') || undefined, country]
        .filter((p): p is string => !!p)
        .join(', ');

    const emails = parseHomelabEmails(row.emails);
    const emailResolution = resolveContactEmail({ emails });

    const placeId = str(row, 'place_id');
    const hours = str(row, 'open_hours');

    return {
        contactType: 'place',
        title: str(row, 'title') ?? '',
        category: str(row, 'category'),
        address: str(row, 'address') ?? (composed || undefined),
        street,
        city,
        state,
        postalCode,
        country,
        phone: str(row, 'phone'),
        website: str(row, 'website'),
        email: emailResolution.email,
        emailRejected: emailResolution.emailRejected,
        emailRejectedReason: emailResolution.emailRejectedReason,
        rating: numeric(row, 'review_rating'),
        reviewCount: numeric(row, 'review_count'),
        latitude: numeric(row, 'latitude'),
        longitude: numeric(row, 'longitude'),
        openingHours: hours && hours !== '{}' && hours !== 'null' ? hours : undefined,
        imageUrl: str(row, 'thumbnail'),
        googleMapsUrl: str(row, 'link'),
        placeId,
        rawData: {
            ...row,
            // Keep the structured forms next to the raw strings.
            emails,
            ...(completeAddress ? { complete_address: completeAddress } : {}),
        },
    };
}

export const homelabTemplate: ScraperTemplate = {
    key: HOMELAB_SCRAPER_KEY,
    source: 'google_maps',
    contactType: 'place',
    provider: 'homelab',
    ownerOnly: true,
    label: 'Google Maps (Homelab)',
    description: 'Owner-only. Google Maps listings with emails, scraped on the homelab at no credit cost. One search at a time; takes several minutes.',
    billing: 'pay_per_result',
    extractsEmails: true,

    inputSchema: [
        { key: 'query', type: 'text', label: 'What to search', placeholder: 'e.g. barber shop', required: true },
        { key: 'location', type: 'text', label: 'Location', placeholder: 'e.g. Framingham, MA', required: true },
    ],

    defaults: {
        // Display label only; the job does not run on Apify.
        actorId: 'gosom/google-maps-scraper',
        actorName: 'Google Maps Scraper (Homelab)',
        costPerResultUsd: 0,
        fixedStartCostUsd: 0,
        memoryMb: 2048,
        creditsPerResult: 0,
        minResults: 1,
        maxResults: 200,
        isActive: true,
    },

    /** Builds the engine's `POST /api/v1/jobs` body. */
    buildInput(params: ScraperSearchParams): Record<string, unknown> {
        const query = (params.query ?? '').trim();
        const location = (params.location ?? '').trim();
        const keyword = `${query} in ${location}`;
        const { depth, maxTimeSeconds } = getHomelabJobSettings();

        return {
            name: `xcraper: ${keyword}`.slice(0, 120),
            keywords: [keyword],
            lang: params.language || 'en',
            depth,
            email: true,
            max_time: maxTimeSeconds,
            fast_mode: false,
        };
    },

    buildStartOptions(): ActorStartOptions {
        return {};
    },

    mapResult: mapHomelabPlace,

    dedupeKey(contact) {
        const cid = typeof contact.rawData?.cid === 'string' ? contact.rawData.cid.trim() : '';
        return contact.placeId || (cid ? `cid:${cid}` : undefined);
    },
};
