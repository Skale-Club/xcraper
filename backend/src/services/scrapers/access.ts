import type { ScraperTemplate } from './types.js';

/**
 * Owner-only gate for scraper templates flagged `ownerOnly` (today: `homelab`).
 *
 * The rule is deliberately NOT "is an admin": the homelab scraper runs on the
 * owner's home server, so a second admin must not be able to start jobs there.
 * Only the account whose email equals SUPER_ADMIN_EMAIL (case-insensitive, trimmed)
 * passes. Enforced server-side in every route that lists scrapers or creates a search.
 */
export const DEFAULT_SUPER_ADMIN_EMAIL = 'skale.club@gmail.com';

export function getSuperAdminEmail(): string {
    const configured = process.env.SUPER_ADMIN_EMAIL?.trim();
    return (configured || DEFAULT_SUPER_ADMIN_EMAIL).toLowerCase();
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
    if (typeof email !== 'string') return false;
    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 && normalized === getSuperAdminEmail();
}

/** Whether `email` may see/run `template`. Templates without `ownerOnly` are open to everyone. */
export function canUseScraper(
    template: Pick<ScraperTemplate, 'ownerOnly'>,
    email: string | null | undefined,
): boolean {
    return !template.ownerOnly || isSuperAdminEmail(email);
}

export const SCRAPER_FORBIDDEN_MESSAGE = 'This scraper is restricted to the account owner.';
