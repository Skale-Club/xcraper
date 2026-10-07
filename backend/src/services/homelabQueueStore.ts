import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { searchHistory, type SearchHistory } from '../db/schema.js';
import type { StartedTask } from './apify.js';

/**
 * Persistence for the homelab queue. Everything that must be atomic lives here, in
 * SQL, so services/homelabQueue.ts (the logic) can be tested against an in-memory
 * store with the same contract.
 */

const HOMELAB = 'homelab';

/** Arbitrary constant namespacing the advisory lock that serialises dispatchers. */
const DISPATCH_LOCK_KEY = 7_424_001;

export interface HomelabQueueStore {
    /** Mark queued searches created before `cutoff` as failed; returns how many. */
    expireQueuedBefore(cutoff: Date, message: string, now: Date): Promise<number>;
    /** True if a homelab search is pending/running and not past `activeCutoff`. */
    hasActive(activeCutoff: Date): Promise<boolean>;
    /**
     * Atomically move the OLDEST queued homelab search to `pending`, but only if no
     * homelab search is active. Returns the claimed row, or null.
     */
    claimOldestQueued(now: Date, activeCutoff: Date): Promise<SearchHistory | null>;
    /** Queued homelab search ids, oldest first. */
    listQueuedIds(): Promise<string[]>;
    getById(id: string): Promise<SearchHistory | null>;
    markStarted(id: string, task: StartedTask, now: Date): Promise<void>;
    markStartFailed(id: string, message: string, now: Date): Promise<void>;
}

export const homelabQueueStore: HomelabQueueStore = {
    async expireQueuedBefore(cutoff, message, now) {
        const expired = await db.update(searchHistory)
            .set({
                status: 'failed',
                errorMessage: message,
                errorCode: 'HOMELAB_QUEUE_EXPIRED',
                errorDetails: { type: 'HomelabQueueExpired', message, timestamp: now.toISOString() },
                apifyStatusMessage: message,
                failedAt: now,
                completedAt: now,
            })
            .where(and(
                eq(searchHistory.scrapeType, HOMELAB),
                eq(searchHistory.status, 'queued'),
                lt(searchHistory.createdAt, cutoff),
            ))
            .returning({ id: searchHistory.id });
        return expired.length;
    },

    async hasActive(activeCutoff) {
        const [active] = await db
            .select({ id: searchHistory.id })
            .from(searchHistory)
            .where(and(
                eq(searchHistory.scrapeType, HOMELAB),
                inArray(searchHistory.status, ['pending', 'running']),
                sql`coalesce(${searchHistory.apifyStartedAt}, ${searchHistory.createdAt}) > ${activeCutoff.toISOString()}::timestamp`,
            ))
            .limit(1);
        return !!active;
    },

    async claimOldestQueued(now, activeCutoff) {
        return db.transaction(async (tx) => {
            // Serialise dispatchers. Transaction-scoped, so it is released on commit and
            // works behind a transaction-mode pooler.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${DISPATCH_LOCK_KEY})`);

            // One conditional statement: claim the oldest queued row only when no homelab
            // search is active. `status = 'queued'` in the outer WHERE makes a concurrent
            // claim (or a cancel) of the same row re-check and match nothing.
            const claimed = await tx.execute(sql`
                UPDATE search_history
                SET status = 'pending', apify_started_at = ${now.toISOString()}::timestamp
                WHERE scrape_type = 'homelab'
                  AND status = 'queued'
                  AND id = (
                      SELECT q.id FROM search_history q
                      WHERE q.scrape_type = 'homelab' AND q.status = 'queued'
                      ORDER BY q.created_at ASC, q.id ASC
                      LIMIT 1
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM search_history a
                      WHERE a.scrape_type = 'homelab'
                        AND a.status IN ('pending', 'running')
                        AND COALESCE(a.apify_started_at, a.created_at) > ${activeCutoff.toISOString()}::timestamp
                  )
                RETURNING id
            `);

            const id = (claimed.rows[0] as { id?: string } | undefined)?.id;
            if (!id) return null;

            const [row] = await tx.select().from(searchHistory).where(eq(searchHistory.id, id)).limit(1);
            return row ?? null;
        });
    },

    async listQueuedIds() {
        const rows = await db
            .select({ id: searchHistory.id })
            .from(searchHistory)
            .where(and(eq(searchHistory.scrapeType, HOMELAB), eq(searchHistory.status, 'queued')))
            .orderBy(asc(searchHistory.createdAt), asc(searchHistory.id));
        return rows.map((r) => r.id);
    },

    async getById(id) {
        const [row] = await db.select().from(searchHistory).where(eq(searchHistory.id, id)).limit(1);
        return row ?? null;
    },

    async markStarted(id, task, now) {
        await db.update(searchHistory)
            .set({
                apifyRunId: task.runId,
                apifyActorId: task.actorId,
                apifyActorName: task.actorName,
                apifyInput: task.input,
                status: 'running',
                errorMessage: null,
                errorCode: null,
                errorDetails: null,
                failedAt: null,
                // Time spent queued must not count against the job deadline: measure from now.
                apifyStartedAt: task.startedAt ?? now,
            })
            .where(and(eq(searchHistory.id, id), eq(searchHistory.status, 'pending')));
    },

    async markStartFailed(id, message, now) {
        await db.update(searchHistory)
            .set({
                status: 'failed',
                errorMessage: message,
                errorCode: 'HOMELAB_START_FAILED',
                errorDetails: { type: 'HomelabStartFailed', message, timestamp: now.toISOString() },
                apifyStatusMessage: message,
                failedAt: now,
                completedAt: now,
            })
            .where(and(eq(searchHistory.id, id), eq(searchHistory.status, 'pending')));
    },
};
