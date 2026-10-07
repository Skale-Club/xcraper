import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.js', () => ({ db: {} }));
vi.mock('./scrapeProvider.js', () => ({ startScrapingTask: vi.fn() }));

import type { SearchHistory } from '../db/schema.js';
import type { StartedTask } from './apify.js';
import { HomelabError } from './homelab.js';
import { isHomelabSearchOverdue } from './homelabBusy.js';
import {
    HOMELAB_QUEUE_EXPIRED_MESSAGE,
    HOMELAB_QUEUE_MAX_WAIT_MS,
    dispatchHomelabQueueSafely,
    getHomelabQueuePosition,
    startNextQueuedHomelabSearch,
} from './homelabQueue.js';
import type { HomelabQueueStore } from './homelabQueueStore.js';
import { startScrapingTask } from './scrapeProvider.js';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-10-07T12:00:00Z');

type Row = Pick<SearchHistory,
    'id' | 'status' | 'scrapeType' | 'query' | 'location' | 'requestedMaxResults' | 'createdAt' | 'apifyStartedAt' | 'apifyRunId' | 'errorMessage'>;

/**
 * In-memory store honouring the same contract as the SQL store. Each mutating method
 * does its check-and-set synchronously (after one await, to force interleaving between
 * concurrent callers), which is exactly the guarantee the SQL gives through its single
 * conditional UPDATE under the advisory lock. The SQL itself is NOT exercised here.
 */
function createStore(rows: Row[]): HomelabQueueStore & { rows: Row[] } {
    const queued = () => rows
        .filter((r) => r.scrapeType === 'homelab' && r.status === 'queued')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

    return {
        rows,
        async expireQueuedBefore(cutoff, message, now) {
            await Promise.resolve();
            let count = 0;
            for (const r of queued()) {
                if (r.createdAt < cutoff) {
                    r.status = 'failed';
                    r.errorMessage = message;
                    r.apifyStartedAt = r.apifyStartedAt ?? null;
                    void now;
                    count++;
                }
            }
            return count;
        },
        async hasActive(activeCutoff) {
            await Promise.resolve();
            return rows.some((r) =>
                r.scrapeType === 'homelab'
                && (r.status === 'pending' || r.status === 'running')
                && (r.apifyStartedAt ?? r.createdAt) > activeCutoff);
        },
        async claimOldestQueued(now, activeCutoff) {
            await Promise.resolve();
            // --- atomic section (synchronous) ---
            const active = rows.some((r) =>
                r.scrapeType === 'homelab'
                && (r.status === 'pending' || r.status === 'running')
                && (r.apifyStartedAt ?? r.createdAt) > activeCutoff);
            const oldest = queued()[0];
            if (active || !oldest) return null;
            oldest.status = 'pending';
            oldest.apifyStartedAt = now;
            return { ...oldest } as unknown as SearchHistory;
        },
        async listQueuedIds() {
            return queued().map((r) => r.id);
        },
        async getById(id) {
            return (rows.find((r) => r.id === id) ?? null) as unknown as SearchHistory | null;
        },
        async markStarted(id, task, now) {
            const row = rows.find((r) => r.id === id && r.status === 'pending');
            if (!row) return;
            row.status = 'running';
            row.apifyRunId = task.runId;
            row.apifyStartedAt = task.startedAt ?? now;
        },
        async markStartFailed(id, message) {
            const row = rows.find((r) => r.id === id && r.status === 'pending');
            if (!row) return;
            row.status = 'failed';
            row.errorMessage = message;
        },
    };
}

function row(id: string, minutesAgo: number, overrides: Partial<Row> = {}): Row {
    return {
        id,
        status: 'queued',
        scrapeType: 'homelab',
        query: `query ${id}`,
        location: 'Framingham, MA',
        requestedMaxResults: 30,
        createdAt: new Date(NOW.getTime() - minutesAgo * 60_000),
        apifyStartedAt: null,
        apifyRunId: null,
        errorMessage: null,
        ...overrides,
    };
}

const start = vi.mocked(startScrapingTask);

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    start.mockReset();
    start.mockImplementation(async (_key, params) => ({
        runId: `job-for-${params.query}`,
        actorId: 'gosom/google-maps-scraper',
        actorName: 'Google Maps Scraper (Homelab)',
        scraperKey: 'homelab',
        input: {},
        startOptions: {},
        startedAt: NOW,
    }) as StartedTask);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('startNextQueuedHomelabSearch', () => {
    it('starts the oldest queued search when the homelab is idle', async () => {
        const store = createStore([row('B', 10), row('A', 30)]);

        const result = await startNextQueuedHomelabSearch(NOW, store);

        expect(result).toEqual({ outcome: 'started', searchId: 'A', runId: 'job-for-query A' });
        expect(start).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledWith('homelab', expect.objectContaining({ query: 'query A', location: 'Framingham, MA', maxResults: 30 }));
        expect(store.rows.find((r) => r.id === 'A')).toMatchObject({ status: 'running', apifyRunId: 'job-for-query A' });
        expect(store.rows.find((r) => r.id === 'B')?.status).toBe('queued');
    });

    it('does not start anything while another homelab search is active', async () => {
        for (const status of ['pending', 'running'] as const) {
            const store = createStore([
                row('active', 20, { status, apifyStartedAt: new Date(NOW.getTime() - 5 * 60_000) }),
                row('waiting', 10),
            ]);

            const result = await startNextQueuedHomelabSearch(NOW, store);

            expect(result).toEqual({ outcome: 'busy' });
            expect(start).not.toHaveBeenCalled();
            expect(store.rows.find((r) => r.id === 'waiting')?.status).toBe('queued');
        }
    });

    it('serves three searches in FIFO order, one at a time, as each active one finishes', async () => {
        // Inserted out of order on purpose.
        const store = createStore([row('C', 5), row('A', 30), row('B', 15)]);
        const order: string[] = [];

        for (let turn = 0; turn < 3; turn++) {
            const result = await startNextQueuedHomelabSearch(NOW, store);
            expect(result.outcome).toBe('started');
            order.push((result as { searchId: string }).searchId);

            // While it runs, the dispatcher is a no-op.
            expect(await startNextQueuedHomelabSearch(NOW, store)).toEqual({ outcome: 'busy' });

            // The running search reaches a terminal state, freeing the slot.
            store.rows.find((r) => r.id === order[turn])!.status = 'completed';
        }

        expect(order).toEqual(['A', 'B', 'C']);
        expect(start).toHaveBeenCalledTimes(3);
        expect(await startNextQueuedHomelabSearch(NOW, store)).toEqual({ outcome: 'none' });
    });

    it('starts the oldest queued search when the active one finishes', async () => {
        const store = createStore([
            row('running', 60, { status: 'running', apifyStartedAt: new Date(NOW.getTime() - 3 * 60_000) }),
            row('first', 40),
            row('second', 20),
        ]);
        expect((await startNextQueuedHomelabSearch(NOW, store)).outcome).toBe('busy');

        store.rows.find((r) => r.id === 'running')!.status = 'failed';
        const result = await startNextQueuedHomelabSearch(NOW, store);

        expect(result).toMatchObject({ outcome: 'started', searchId: 'first' });
    });

    it('starts exactly one search when dispatchers run concurrently', async () => {
        const store = createStore([row('A', 30), row('B', 20), row('C', 10)]);

        const results = await Promise.all([
            startNextQueuedHomelabSearch(NOW, store),
            startNextQueuedHomelabSearch(NOW, store),
            startNextQueuedHomelabSearch(NOW, store),
            startNextQueuedHomelabSearch(NOW, store),
        ]);

        expect(start).toHaveBeenCalledTimes(1);
        expect(results.filter((r) => r.outcome === 'started')).toHaveLength(1);
        expect(store.rows.filter((r) => r.status === 'running')).toHaveLength(1);
        expect(store.rows.filter((r) => r.status === 'queued').map((r) => r.id).sort()).toEqual(['B', 'C']);
    });

    it('ignores an active search that outlived max_time plus the grace period (stale slot)', async () => {
        const store = createStore([
            row('stale', 300, { status: 'running', apifyStartedAt: new Date(NOW.getTime() - 3 * HOUR) }),
            row('waiting', 10),
        ]);

        const result = await startNextQueuedHomelabSearch(NOW, store);

        expect(result).toMatchObject({ outcome: 'started', searchId: 'waiting' });
    });

    it('fails a search still queued after 24 hours, with an expiry message', async () => {
        const store = createStore([
            row('old', 25 * 60),
            row('fresh', 23 * 60),
        ]);

        const result = await startNextQueuedHomelabSearch(NOW, store);

        const old = store.rows.find((r) => r.id === 'old')!;
        expect(old.status).toBe('failed');
        expect(old.errorMessage).toBe(HOMELAB_QUEUE_EXPIRED_MESSAGE);
        expect(old.errorMessage).toMatch(/expired in the homelab queue/);
        // The expired one is never started; the next oldest takes the slot.
        expect(result).toMatchObject({ outcome: 'started', searchId: 'fresh' });
        expect(start).toHaveBeenCalledTimes(1);
        expect(HOMELAB_QUEUE_MAX_WAIT_MS).toBe(24 * HOUR);
    });

    it('does not expire a search queued just under 24 hours', async () => {
        const store = createStore([row('edge', 24 * 60 - 1, { status: 'queued' })]);
        const result = await startNextQueuedHomelabSearch(NOW, store);
        expect(result).toMatchObject({ outcome: 'started', searchId: 'edge' });
    });

    it('measures the job deadline from when the job started, not from when it was queued', async () => {
        const store = createStore([row('long-wait', 20 * 60)]);

        await startNextQueuedHomelabSearch(NOW, store);
        const started = store.rows[0];

        // Queued 20h ago, started now: not overdue. Judged from createdAt it would be.
        expect(started.apifyStartedAt).toEqual(NOW);
        expect(isHomelabSearchOverdue({ apifyStartedAt: started.apifyStartedAt, createdAt: started.createdAt }, NOW)).toBe(false);
        expect(isHomelabSearchOverdue({ apifyStartedAt: null, createdAt: started.createdAt }, NOW)).toBe(true);
        // ...and it becomes overdue only max_time (30 min) + 10 min after the start.
        expect(isHomelabSearchOverdue({ apifyStartedAt: started.apifyStartedAt, createdAt: started.createdAt }, new Date(NOW.getTime() + 39 * 60_000))).toBe(false);
        expect(isHomelabSearchOverdue({ apifyStartedAt: started.apifyStartedAt, createdAt: started.createdAt }, new Date(NOW.getTime() + 41 * 60_000))).toBe(true);
    });

    it('never starts a cancelled (paused) search', async () => {
        const store = createStore([row('cancelled', 30, { status: 'paused' }), row('next', 10)]);
        const result = await startNextQueuedHomelabSearch(NOW, store);
        expect(result).toMatchObject({ outcome: 'started', searchId: 'next' });
        expect(store.rows.find((r) => r.id === 'cancelled')?.status).toBe('paused');
    });

    it('marks a search failed, naming the homelab, when the start fails; the next trigger moves on', async () => {
        const store = createStore([row('A', 30), row('B', 10)]);
        start.mockRejectedValueOnce(new HomelabError('The homelab scraper is unavailable (HTTP 502). Use the Apify scrapers.', 'unreachable'));

        const failed = await startNextQueuedHomelabSearch(NOW, store);

        expect(failed).toMatchObject({ outcome: 'failed', searchId: 'A' });
        expect(store.rows.find((r) => r.id === 'A')).toMatchObject({ status: 'failed' });
        expect(store.rows.find((r) => r.id === 'A')?.errorMessage).toMatch(/homelab/i);
        expect(store.rows.find((r) => r.id === 'B')?.status).toBe('queued');

        const next = await startNextQueuedHomelabSearch(NOW, store);
        expect(next).toMatchObject({ outcome: 'started', searchId: 'B' });
    });

    it('reports none when nothing is queued', async () => {
        expect(await startNextQueuedHomelabSearch(NOW, createStore([]))).toEqual({ outcome: 'none' });
        expect(start).not.toHaveBeenCalled();
    });
});

describe('dispatchHomelabQueueSafely', () => {
    it('swallows store errors so a trigger point never breaks its request', async () => {
        const store = createStore([]);
        store.expireQueuedBefore = async () => {
            throw new Error('db down');
        };
        await expect(dispatchHomelabQueueSafely(store)).resolves.toBeNull();
    });
});

describe('getHomelabQueuePosition', () => {
    it('is 1-based in FIFO order and null for searches that are not queued', async () => {
        const store = createStore([row('C', 5), row('A', 30), row('B', 15), row('R', 60, { status: 'running' })]);
        expect(await getHomelabQueuePosition('A', store)).toBe(1);
        expect(await getHomelabQueuePosition('B', store)).toBe(2);
        expect(await getHomelabQueuePosition('C', store)).toBe(3);
        expect(await getHomelabQueuePosition('R', store)).toBeNull();
        expect(await getHomelabQueuePosition('missing', store)).toBeNull();
    });
});
