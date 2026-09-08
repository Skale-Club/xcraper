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

export interface EmailResolution {
    /** The first non-placeholder candidate, if any. */
    email?: string;
    /** The placeholder value that was discarded, kept for coverage honesty. */
    emailRejected?: string;
    emailRejectedReason?: 'placeholder';
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
 * Pick the first real (non-placeholder) email out of every candidate the item
 * offers. When the first candidate is a placeholder, the next one is tried
 * before giving up — a listing can legitimately have both a template filler
 * address and a real one further down `item.emails`.
 *
 * Only reports `emailRejectedReason` when NO candidate survives — if a later
 * candidate resolves to a real address, the placeholder was correctly skipped
 * and there is nothing to flag.
 *
 * This is deliberate, not an oversight: `[placeholder, real]` returns `{ email: real }`
 * with NO rejection record, because coverage was never lost — the business still ends
 * up with a usable email. `[placeholder]` alone returns a rejection record, because that
 * business is left with nothing. The run-level metric built from this (see
 * `emails_lost_to_placeholder` in `services/xphere.ts`) answers "how many businesses ended
 * up with no email because the only thing on offer was template filler" — it is NOT a count
 * of every placeholder string seen. Do not change this to count every rejected candidate;
 * that would turn a "missing email" metric into a "placeholder sighted" metric and make it
 * lie about coverage loss.
 */
export function resolveContactEmail(item: { email?: unknown; emails?: unknown }): EmailResolution {
    const candidates = collectEmailCandidates(item);
    let firstRejected: string | undefined;

    for (const candidate of candidates) {
        if (isPlaceholderEmail(candidate)) {
            if (firstRejected === undefined) firstRejected = candidate;
            continue;
        }
        return { email: candidate };
    }

    if (firstRejected !== undefined) {
        return { emailRejected: firstRejected, emailRejectedReason: 'placeholder' };
    }

    return {};
}

/**
 * Whether a `contacts.raw_data` value carries the placeholder-rejection marker
 * `buildContactRow` (src/routes/search.ts) writes under `_xcraper`. Lets a run's
 * rejected-placeholder count be recomputed later from persisted rows, e.g. when
 * building the Xphere push metadata for an already-scraped run.
 */
export function wasEmailRejectedAsPlaceholder(rawData: unknown): boolean {
    if (typeof rawData !== 'object' || rawData === null) return false;
    const marker = (rawData as { _xcraper?: { emailRejectedReason?: unknown } })._xcraper;
    return marker?.emailRejectedReason === 'placeholder';
}
