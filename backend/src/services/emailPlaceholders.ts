/**
 * Denylist for website-template placeholder emails.
 *
 * Google Maps listings frequently surface the "contact us" address baked into a
 * template the business never replaced — GoDaddy's stock builder page, a Wix
 * starter, a generic "yoursite.com" example — rather than a real inbox. Three
 * runs on 2026-09 paid to verify 98 emails end to end and 4 of them were exactly
 * this: `filler@godaddy.com` three times and `contact@seusite.com.br` once, all
 * invalid. None of that spend buys a real lead, so these addresses are rejected
 * before they ever reach the DB or a paid verification call.
 */

/** Exact addresses known to be template filler, independent of domain rules below. */
const PLACEHOLDER_EXACT_ADDRESSES = new Set(['filler@godaddy.com']);

/**
 * Domains that only ever appear as boilerplate — page-builder examples, the
 * error-tracking snippet's "from" address, etc. Matches the domain itself and
 * any subdomain of it (`sentry-next.wixpress.com` is a subdomain of
 * `wixpress.com`, and both are placeholders for the same reason).
 */
const PLACEHOLDER_DOMAINS = new Set([
    'seusite.com.br',
    'example.com',
    'example.org',
    'yourdomain.com',
    'domain.com',
    'email.com',
    'sentry.io',
    'sentry-next.wixpress.com',
    'wixpress.com',
]);

/** Local parts that are placeholder at any domain (`test@anything`, `noreply@anything`). */
const PLACEHOLDER_LOCAL_PARTS = new Set(['test', 'noreply', 'no-reply', 'donotreply']);

/**
 * Domains belonging to a scheduling/booking marketplace platform rather than the
 * business itself. When a local business (a barbershop, in the evidence below)
 * has no site of its own, the "website" Google Maps surfaces for it is often its
 * listing page on one of these platforms instead — and the contact email scraped
 * off that page is the platform's own inbox, not the business's.
 *
 * Evidence from production (measured 2026-09-30): `help.us@booksy.com` is
 * recorded as the contact email for 11 different barbershops (Biig Style,
 * Master Barbers, Longwood Barbershop, Smitty's Barbershop, and others) — a cold
 * email to that address would reach Booksy's support inbox 11 times, never any
 * of the businesses. Separately, `privacy@pocketsuite.io` is recorded as a
 * barbershop's contact email for the same reason (PocketSuite). Neither is
 * caught by paid mailbox verification, because the inbox is genuinely real and
 * accepts mail — only knowing *whose* domain it is catches it, which is exactly
 * what this set is for.
 *
 * Matches the domain itself and any subdomain (a business-specific page like
 * `chichi-barbershop.booksy.net` is still Booksy's domain, not the business's —
 * see `webPresence.ts`'s `BOOKING_PLATFORMS`, which classifies the equivalent
 * website URLs on the same reasoning).
 */
const PLATFORM_EMAIL_DOMAINS = new Set([
    'booksy.com',
    'booksy.net',
    'vagaro.com',
    'styleseat.com',
    'schedulicity.com',
    'fresha.com',
    'setmore.com',
    'squareup.com',
    'square.site',
    'mindbodyonline.com',
    'glossgenius.com',
    'genbook.com',
    'acuityscheduling.com',
    'zenoti.com',
    'boulevard.io',
    'pocketsuite.io',
]);

/**
 * Generic template domains of the shape "yourdomain.com", "mysite.net",
 * "website.com.br" — the exact string a page builder ships as a fill-in-the-blank
 * example, not a business that happens to be named "Domain" or "Company".
 */
const GENERIC_PLACEHOLDER_DOMAIN_PATTERN = /^(your|my)?(domain|site|website|company)\.(com|net|org|br|com\.br)$/i;

function splitEmail(trimmedLower: string): { localPart: string; domain: string } {
    const atIndex = trimmedLower.lastIndexOf('@');
    if (atIndex === -1) return { localPart: trimmedLower, domain: '' };
    return {
        localPart: trimmedLower.slice(0, atIndex),
        domain: trimmedLower.slice(atIndex + 1),
    };
}

function domainMatches(domain: string, denylisted: string): boolean {
    return domain === denylisted || domain.endsWith(`.${denylisted}`);
}

/** Whether an email address is a known website-template placeholder rather than a real inbox. */
export function isPlaceholderEmail(email: string): boolean {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return false;

    if (PLACEHOLDER_EXACT_ADDRESSES.has(trimmed)) return true;

    const { localPart, domain } = splitEmail(trimmed);
    if (!domain) return false;

    if ([...PLACEHOLDER_DOMAINS].some((denylisted) => domainMatches(domain, denylisted))) return true;
    if (PLACEHOLDER_LOCAL_PARTS.has(localPart)) return true;
    if (GENERIC_PLACEHOLDER_DOMAIN_PATTERN.test(domain)) return true;

    return false;
}

/**
 * Whether an email's domain belongs to a scheduling/booking marketplace platform
 * (Booksy, PocketSuite, etc.) rather than the business itself — see
 * `PLATFORM_EMAIL_DOMAINS` above for the evidence. Deliberately a separate check
 * from `isPlaceholderEmail`: the address is not template filler and the inbox is
 * real, it is just owned by the wrong company, which is why callers that need to
 * tell the two apart (see `resolveContactEmail`'s `emailRejectedReason`) can.
 */
export function isPlatformDomainEmail(email: string): boolean {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return false;

    const { domain } = splitEmail(trimmed);
    if (!domain) return false;

    return [...PLATFORM_EMAIL_DOMAINS].some((denylisted) => domainMatches(domain, denylisted));
}

/** Why a candidate email was rejected instead of resolved to a usable contact address. */
export type EmailRejectionReason = 'placeholder' | 'platform_domain';

export interface EmailResolution {
    /** The first candidate that is neither a placeholder nor a platform-owned inbox, if any. */
    email?: string;
    /** The rejected value that was discarded, kept for coverage honesty. */
    emailRejected?: string;
    emailRejectedReason?: EmailRejectionReason;
}

/**
 * Collect email candidates from an Apify item's `email`/`emails` fields, in the
 * order they should be tried, deduplicated and trimmed. Both fields may be a
 * single string or an array depending on the actor version.
 */
export function collectEmailCandidates(item: { email?: unknown; emails?: unknown }): string[] {
    const seen = new Set<string>();
    const candidates: string[] = [];

    const add = (value: unknown) => {
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (trimmed.length === 0) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(trimmed);
    };

    if (Array.isArray(item.email)) item.email.forEach(add);
    else add(item.email);

    if (Array.isArray(item.emails)) item.emails.forEach(add);
    else add(item.emails);

    return candidates;
}

/**
 * Pick the first usable email out of every candidate the item offers, skipping
 * both template-filler placeholders and addresses on a booking-platform's own
 * domain (see `isPlaceholderEmail` / `isPlatformDomainEmail`). When the first
 * candidate is rejected for either reason, the next one is tried before giving
 * up — a listing can legitimately have both a junk address and a real one
 * further down `item.emails`.
 *
 * Only reports `emailRejectedReason` when NO candidate survives — if a later
 * candidate resolves to a real address, the earlier one was correctly skipped
 * and there is nothing to flag. The reported reason is whichever the FIRST
 * candidate was rejected for, since that is the one recorded as `emailRejected`.
 *
 * This is deliberate, not an oversight: `[junk, real]` returns `{ email: real }`
 * with NO rejection record, because coverage was never lost — the business still ends
 * up with a usable email. `[junk]` alone returns a rejection record, because that
 * business is left with nothing. The run-level metric built from this (see
 * `emails_lost_to_placeholder` in `services/xphere.ts`) answers "how many businesses ended
 * up with no email because everything on offer was junk (template filler or a
 * platform's own inbox)" — it is NOT a count of every rejected string seen. Do not change
 * this to count every rejected candidate; that would turn a "missing email" metric into a
 * "junk sighted" metric and make it lie about coverage loss.
 */
export function resolveContactEmail(item: { email?: unknown; emails?: unknown }): EmailResolution {
    const candidates = collectEmailCandidates(item);
    let firstRejected: string | undefined;
    let firstRejectedReason: EmailRejectionReason | undefined;

    for (const candidate of candidates) {
        const reason: EmailRejectionReason | null = isPlaceholderEmail(candidate)
            ? 'placeholder'
            : isPlatformDomainEmail(candidate)
                ? 'platform_domain'
                : null;

        if (reason) {
            if (firstRejected === undefined) {
                firstRejected = candidate;
                firstRejectedReason = reason;
            }
            continue;
        }
        return { email: candidate };
    }

    if (firstRejected !== undefined) {
        return { emailRejected: firstRejected, emailRejectedReason: firstRejectedReason };
    }

    return {};
}

/**
 * Whether a `contacts.raw_data` value carries a lost-email-coverage marker
 * `buildContactRow` (src/routes/search.ts) writes under `_xcraper` — either
 * reason `resolveContactEmail` can report (`'placeholder'` or
 * `'platform_domain'`). Both mean the same thing for this purpose: the business
 * ended up with no usable email because every candidate was junk. Lets a run's
 * lost-email count be recomputed later from persisted rows, e.g. when building
 * the Xphere push metadata for an already-scraped run. Despite the name (kept
 * for the metric it feeds, `emails_lost_to_placeholder` in `services/xphere.ts`),
 * this intentionally also counts `'platform_domain'` rejections — narrowing it
 * back to literal placeholders would silently undercount exactly the kind of
 * loss this function exists to measure.
 */
export function wasEmailRejectedAsPlaceholder(rawData: unknown): boolean {
    if (typeof rawData !== 'object' || rawData === null) return false;
    const marker = (rawData as { _xcraper?: { emailRejectedReason?: unknown } })._xcraper;
    return marker?.emailRejectedReason === 'placeholder' || marker?.emailRejectedReason === 'platform_domain';
}
