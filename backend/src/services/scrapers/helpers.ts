import type { NormalizedContact, ScraperGlobalConfig, ScraperRuntimeParams } from './types.js';
import { extractSocialMediaFromRawData } from '../../utils/socialMedia.js';

/** First non-empty string from a value or an array of values. */
export function getFirstString(value: unknown): string | undefined {
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

/** Coerce a value to a finite number, or undefined. */
export function getNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

/** Drop undefined/null/empty-array entries from an actor input object. */
export function pruneEmpty(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(input).filter(([, v]) => {
            if (v === undefined || v === null) return false;
            if (Array.isArray(v) && v.length === 0) return false;
            if (typeof v === 'string' && v.trim().length === 0) return false;
            return true;
        }),
    );
}

/** Normalize an arbitrary value into a string array (for tag-style filters). */
export function toStringArray(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
        const arr = value.map((v) => String(v).trim()).filter((v) => v.length > 0);
        return arr.length > 0 ? arr : undefined;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
    }
    return undefined;
}

/**
 * Cost ceiling for a "pay per result" run:
 *   max(minRunCharge, baseRunCost + fixedStartCost + maxResults * costPerResult)
 * Apify aborts a run once this ceiling is reached — the core cost protection.
 */
export function computeResultChargeCeiling(
    runtime: ScraperRuntimeParams,
    global: ScraperGlobalConfig,
    maxResults: number,
): number {
    return Number(
        Math.max(
            global.minRunChargeUsd,
            global.baseRunCostUsd + runtime.fixedStartCostUsd + maxResults * runtime.costPerResultUsd,
        ).toFixed(3),
    );
}

/**
 * Map a raw Google Maps dataset item (from the standard/enriched actors) into the
 * unified contact shape. Ported from the original apify.ts getTaskResults mapping,
 * tolerant of the actor's inconsistent field naming across versions.
 */
export function mapGooglePlace(item: Record<string, unknown>): NormalizedContact {
    const location =
        typeof item.location === 'object' && item.location !== null
            ? (item.location as { lat?: unknown; lng?: unknown })
            : undefined;

    const lat = getNumber(location?.lat) ?? getNumber(item.latitude);
    const lng = getNumber(location?.lng) ?? getNumber(item.longitude);

    const social = extractSocialMediaFromRawData(item);

    return {
        contactType: 'place',
        title: getFirstString(item.title) || getFirstString(item.name) || '',
        category: getFirstString(item.categoryName) || getFirstString(item.category),
        address: getFirstString(item.address),
        phone: getFirstString(item.phone) || getFirstString(item.phoneNumber) || getFirstString(item.phones),
        website: getFirstString(item.website) || getFirstString(item.url),
        email: getFirstString(item.email) || getFirstString(item.emails),
        rating: getNumber(item.totalScore) ?? getNumber(item.rating),
        reviewCount: getNumber(item.reviewsCount) ?? getNumber(item.reviews),
        latitude: lat,
        longitude: lng,
        openingHours: item.hours ? JSON.stringify(item.hours) : getFirstString(item.openingHours),
        imageUrl: getFirstString(item.image) || getFirstString(item.imageUrl),
        googleMapsUrl: getFirstString(item.url) || getFirstString(item.googleMapsUrl),
        placeId: getFirstString(item.placeId),
        facebook: social.facebook,
        instagram: social.instagram,
        twitter: social.twitter,
        linkedin: social.linkedin,
        youtube: social.youtube,
        tiktok: social.tiktok,
        pinterest: social.pinterest,
        rawData: item,
    };
}
