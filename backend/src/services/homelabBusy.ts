import { and, eq, gt, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { searchHistory } from '../db/schema.js';
import { HOMELAB_OVERDUE_GRACE_MS, getHomelabJobSettings } from './homelab.js';
import { HOMELAB_SCRAPER_KEY } from './scrapers/templates/homelab.js';

/**
 * The homelab runs exactly one job at a time on purpose (it shares a home server),
 * so a second homelab search is refused while another is pending/running in our DB.
 * Rows older than the job deadline (max_time + grace) are ignored so a search that
 * was never polled to a terminal state cannot block the homelab forever.
 */
export const HOMELAB_BUSY_MESSAGE =
    'The homelab scraper is busy with another search; try again in a few minutes.';

export async function findActiveHomelabSearch(now: Date = new Date()): Promise<{ id: string } | null> {
    const { maxTimeSeconds } = getHomelabJobSettings();
    const cutoff = new Date(now.getTime() - maxTimeSeconds * 1000 - HOMELAB_OVERDUE_GRACE_MS);

    const [active] = await db
        .select({ id: searchHistory.id })
        .from(searchHistory)
        .where(and(
            eq(searchHistory.scrapeType, HOMELAB_SCRAPER_KEY),
            inArray(searchHistory.status, ['pending', 'running']),
            gt(searchHistory.createdAt, cutoff),
        ))
        .limit(1);

    return active ?? null;
}

/** True when a homelab search has outlived its deadline without reaching a terminal state. */
export function isHomelabSearchOverdue(
    record: { apifyStartedAt: Date | null; createdAt: Date },
    now: Date = new Date(),
): boolean {
    const { maxTimeSeconds } = getHomelabJobSettings();
    const startedAt = record.apifyStartedAt ?? record.createdAt;
    return now.getTime() - startedAt.getTime() > maxTimeSeconds * 1000 + HOMELAB_OVERDUE_GRACE_MS;
}
