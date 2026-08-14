import { db } from '../db/index.js';
import { contacts, searchHistory, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logError } from '../utils/logger.js';

// Xphere is the prospecting hub: Xcraper pushes extracted business leads into the
// caller's Xphere workspace via the public ingestion API (POST /api/v1/prospects),
// authenticated with an Xphere API key (xph_...) holding the prospects:write scope.
//
// Configuration is environment-driven (no hardcoded domains, per the integration
// contract): set XPHERE_API_URL (defaults to the canonical production origin) and
// XPHERE_API_KEY for the deployment.

const DEFAULT_XPHERE_API_URL = 'https://xphere.app';
const ENV_XPHERE_API_KEY = process.env.XPHERE_API_KEY || '';
const ENV_XPHERE_API_URL = process.env.XPHERE_API_URL || '';

// The ingestion endpoint accepts up to 1000 records per call; stay under it.
const BATCH_SIZE = 500;

type XphereConfig = { apiUrl: string; apiKey: string };

/**
 * Resolve the Xphere credentials for a user. Prefers the user's OWN key (set in
 * their profile panel) so each user pushes into their own Xphere workspace; falls
 * back to a deployment-wide env var if present (legacy). Null if neither is set.
 */
export async function resolveXphereConfig(userId: string): Promise<XphereConfig | null> {
    const [user] = await db
        .select({ apiKey: users.xphereApiKey, apiUrl: users.xphereApiUrl })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    const apiKey = (user?.apiKey || ENV_XPHERE_API_KEY || '').trim();
    if (!apiKey) return null;

    const apiUrl = (user?.apiUrl || ENV_XPHERE_API_URL || DEFAULT_XPHERE_API_URL)
        .trim()
        .replace(/\/$/, '');
    return { apiUrl, apiKey };
}

/** Whether the given user can push to Xphere (own key, or env fallback). */
export async function isXphereConfiguredForUser(userId: string): Promise<boolean> {
    return (await resolveXphereConfig(userId)) !== null;
}

/** Best-effort registrable domain from a scraped website URL. */
function hostnameFromWebsite(website?: string | null): string | null {
    if (!website) return null;
    try {
        const url = website.startsWith('http') ? website : `https://${website}`;
        return new URL(url).hostname.replace(/^www\./, '') || null;
    } catch {
        return null;
    }
}

interface ProspectPayload {
    kind: 'company';
    name: string;
    domain: string | null;
    phone: string | null;
    source_id: string;
    recommended_channel: 'email' | 'call' | null;
    custom_fields: Record<string, unknown>;
    source_payload: Record<string, unknown>;
}

export type PushResult =
    | { ok: true; total: number; created: number; updated: number; skipped: number }
    | { ok: false; error: string };

type SearchHistoryRow = typeof searchHistory.$inferSelect;

/**
 * Build the `source.metadata` block sent to Xphere for a run.
 *
 * Exported as a pure function (no I/O) so the numeric/null handling around
 * `apify_usage_usd` can be unit tested in isolation from `pushRunToXphere`.
 */
export function buildSourceMetadata(
    run: Pick<SearchHistoryRow, 'query' | 'location' | 'apifyUsageUsd' | 'apifyActorId' | 'scrapeType' | 'searchFilters'>,
    resultCount: number,
): Record<string, unknown> {
    // Drizzle maps `decimal` columns to strings, and the column is nullable
    // (a run that never completed has no usage figure). Send `null` rather
    // than `0` when the cost is unknown or unparseable — 0 is a real and
    // very different claim ("this run cost nothing") from "unknown".
    const parsedCost = run.apifyUsageUsd === null || run.apifyUsageUsd === undefined
        ? NaN
        : Number(run.apifyUsageUsd);
    const cost_usd = Number.isFinite(parsedCost) ? parsedCost : null;

    const metadata: Record<string, unknown> = {
        query: run.query,
        location: run.location,
        cost_usd,
        result_count: resultCount,
    };
    if (run.apifyActorId) metadata.actor_id = run.apifyActorId;
    if (run.scrapeType) metadata.template = run.scrapeType;
    const hypothesis = run.searchFilters?.journey_hypothesis;
    if (hypothesis && typeof hypothesis === 'object' && !Array.isArray(hypothesis)) {
        metadata.hypothesis = hypothesis;
    }

    return metadata;
}

async function postBatch(
    config: XphereConfig,
    source: Record<string, unknown>,
    prospects: ProspectPayload[],
): Promise<{ created: number; updated: number; skipped: number } | { error: string }> {
    try {
        const res = await fetch(`${config.apiUrl}/api/v1/prospects`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ source, prospects }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
            return { error: (data.error as string) || `Xphere returned HTTP ${res.status}` };
        }
        return {
            created: (data.created as number) ?? 0,
            updated: (data.updated as number) ?? 0,
            skipped: (data.skipped as number) ?? 0,
        };
    } catch (err) {
        logError('pushRunToXphere: request failed', err as Error);
        return { error: 'Could not reach Xphere.' };
    }
}

/**
 * Push every contact of a completed scrape run into Xphere as company prospects.
 * Records are deduplicated on the Xphere side by source_id (the Google Place ID),
 * so re-pushing a run is idempotent.
 */
export async function pushRunToXphere(searchId: string, userId: string): Promise<PushResult> {
    const config = await resolveXphereConfig(userId);
    if (!config) {
        return { ok: false, error: 'Xphere integration is not configured. Add your Xphere API key in your profile settings.' };
    }

    // Ownership check — only the run's owner can push it.
    const [run] = await db
        .select()
        .from(searchHistory)
        .where(and(eq(searchHistory.id, searchId), eq(searchHistory.userId, userId)))
        .limit(1);
    if (!run) return { ok: false, error: 'Search run not found.' };

    const rows = await db.select().from(contacts).where(eq(contacts.searchId, searchId));
    if (rows.length === 0) return { ok: false, error: 'No contacts in this run to push.' };

    const prospects: ProspectPayload[] = rows.map((c) => ({
        kind: 'company',
        name: c.title,
        domain: hostnameFromWebsite(c.website),
        phone: c.phone ?? null,
        // Google Place ID gives idempotent re-import; fall back to the row id.
        source_id: c.placeId || c.id,
        recommended_channel: c.email ? 'email' : c.phone ? 'call' : null,
        custom_fields: {
            email: c.email ?? null,
            category: c.category ?? null,
            address: c.address ?? null,
            rating: c.rating ?? null,
            review_count: c.reviewCount ?? null,
            website: c.website ?? null,
            google_maps_url: c.googleMapsUrl ?? null,
        },
        source_payload: {
            place_id: c.placeId ?? null,
            latitude: c.latitude ?? null,
            longitude: c.longitude ?? null,
            socials: {
                facebook: c.facebook ?? null,
                instagram: c.instagram ?? null,
                linkedin: c.linkedin ?? null,
            },
        },
    }));

    const source = {
        type: 'xcraper',
        key: 'xcraper',
        label: `${run.query} — ${run.location}`,
        external_run_id: searchId,
        metadata: buildSourceMetadata(run, rows.length),
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
        const batch = prospects.slice(i, i + BATCH_SIZE);
        const result = await postBatch(config, source, batch);
        if ('error' in result) return { ok: false, error: result.error };
        created += result.created;
        updated += result.updated;
        skipped += result.skipped;
    }

    await db.update(searchHistory)
        .set({ xpherePushedAt: new Date() })
        .where(eq(searchHistory.id, searchId));

    return { ok: true, total: prospects.length, created, updated, skipped };
}
