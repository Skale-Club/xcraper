import { z } from 'zod';

/**
 * Prospecting niche: the business segment a scrape targets ("barbershop", "nail_salon").
 *
 * One shared definition for the whole pipeline. Xphere keeps one Meta audience per niche, so
 * the value must be a stable slug: lowercase, singular English, words joined by `_`. The same
 * rule is enforced on the Xphere side; keep the two in sync.
 */
export const NICHE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
export const NICHE_MIN_LENGTH = 2;
export const NICHE_MAX_LENGTH = 40;

export const NICHE_FORMAT_MESSAGE =
    'niche must be a lowercase slug (a-z, 0-9, words joined by "_"), 2-40 characters, singular English, e.g. "barbershop" or "nail_salon"';

export function isValidNiche(value: unknown): value is string {
    return typeof value === 'string'
        && value.length >= NICHE_MIN_LENGTH
        && value.length <= NICHE_MAX_LENGTH
        && NICHE_PATTERN.test(value);
}

/**
 * Zod schema for an optional niche on a request body. Surrounding whitespace is trimmed; the
 * slug itself is NOT rewritten (no lowercasing, no guessing), so a wrong value is rejected
 * with a clear message instead of silently becoming a different niche. `null` is treated as
 * "absent".
 */
export const optionalNicheSchema = z
    .string()
    .trim()
    .refine(isValidNiche, { message: NICHE_FORMAT_MESSAGE })
    .nullish()
    .transform((value) => value ?? undefined);

/** The niche stored on a run (`searchFilters.niche`), or null when the run has none. */
export function readRunNiche(searchFilters: Record<string, unknown> | null | undefined): string | null {
    const niche = searchFilters?.niche;
    return isValidNiche(niche) ? niche : null;
}
