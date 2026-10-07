import { HomelabError, HOMELAB_OVERDUE_GRACE_MS, getHomelabJobSettings } from './homelab.js';
import { homelabQueueStore, type HomelabQueueStore } from './homelabQueueStore.js';
import { startScrapingTask } from './scrapeProvider.js';
import { HOMELAB_SCRAPER_KEY } from './scrapers/templates/homelab.js';

/**
 * FIFO queue in front of the homelab's single job slot.
 *
 * There is no long-running worker (serverless), so dispatch is event driven. The
 * dispatcher is called when a search is created, when a homelab search reaches a
 * terminal state, and whenever a queued search is read (status poll, history, SSE,
 * service poll). It is a cheap no-op while the homelab is busy.
 *
 * Atomicity: see HomelabQueueStore.claimOldestQueued, one conditional UPDATE under a
 * transaction-scoped advisory lock. Two concurrent dispatchers can never both claim.
 */

/** A search still queued after this long is failed. */
export const HOMELAB_QUEUE_MAX_WAIT_MS = 24 * 60 * 60 * 1000;

export const HOMELAB_QUEUE_EXPIRED_MESSAGE =
    'This search expired in the homelab queue after waiting 24 hours. Try again later or use one of the Apify scrapers (Standard or Enriched).';

export type DispatchOutcome =
    | { outcome: 'none' }
    | { outcome: 'busy' }
    | { outcome: 'started'; searchId: string; runId: string }
    | { outcome: 'failed'; searchId: string; message: string };

/** How long a `pending`/`running` search keeps the slot, measured from when it started. */
export function homelabActiveCutoff(now: Date): Date {
    const { maxTimeSeconds } = getHomelabJobSettings();
    return new Date(now.getTime() - maxTimeSeconds * 1000 - HOMELAB_OVERDUE_GRACE_MS);
}

/**
 * Start the oldest queued homelab search if (and only if) the homelab is idle.
 * Starts at most one search per call; if that start fails the search is marked
 * failed (no silent Apify fallback) and the next one is picked up by the next trigger.
 */
export async function startNextQueuedHomelabSearch(
    now: Date = new Date(),
    store: HomelabQueueStore = homelabQueueStore,
): Promise<DispatchOutcome> {
    await store.expireQueuedBefore(
        new Date(now.getTime() - HOMELAB_QUEUE_MAX_WAIT_MS),
        HOMELAB_QUEUE_EXPIRED_MESSAGE,
        now,
    );

    const activeCutoff = homelabActiveCutoff(now);
    if (await store.hasActive(activeCutoff)) return { outcome: 'busy' };

    const claimed = await store.claimOldestQueued(now, activeCutoff);
    if (!claimed) return { outcome: 'none' };

    try {
        const task = await startScrapingTask(HOMELAB_SCRAPER_KEY, {
            maxResults: claimed.requestedMaxResults,
            language: '',
            countryCode: '',
            query: claimed.query,
            location: claimed.location,
        });
        await store.markStarted(claimed.id, task, now);
        return { outcome: 'started', searchId: claimed.id, runId: task.runId };
    } catch (error) {
        // HomelabError messages are user-safe and name the homelab.
        const message = error instanceof HomelabError
            ? error.message
            : 'Failed to start the homelab search. Try again later or use one of the Apify scrapers (Standard or Enriched).';
        console.error(`Homelab queue: failed to start search ${claimed.id}:`, message);
        await store.markStartFailed(claimed.id, message, now);
        return { outcome: 'failed', searchId: claimed.id, message };
    }
}

/** Run the dispatcher from a trigger point; never throws into the caller's request. */
export async function dispatchHomelabQueueSafely(
    store: HomelabQueueStore = homelabQueueStore,
): Promise<DispatchOutcome | null> {
    try {
        return await startNextQueuedHomelabSearch(new Date(), store);
    } catch (error) {
        console.error('Homelab queue dispatch error:', error);
        return null;
    }
}

/** 1-based position in the queue, or null when the search is not queued. */
export async function getHomelabQueuePosition(
    searchId: string,
    store: HomelabQueueStore = homelabQueueStore,
): Promise<number | null> {
    const ids = await store.listQueuedIds();
    const index = ids.indexOf(searchId);
    return index === -1 ? null : index + 1;
}
