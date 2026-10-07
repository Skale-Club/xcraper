import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

type TestUser = { id: string; email: string; role: 'user' | 'admin'; accountRiskFlag?: null };

const state = vi.hoisted(() => ({
    user: null as Record<string, unknown> | null,
    /** What select().from(searchHistory) returns (also used by getOwnedSearch). */
    searchRow: null as Record<string, unknown> | null,
    /** Rows returned by update(...).returning(); [] simulates a lost race. */
    updateReturning: [{ id: 'search-1' }] as Array<Record<string, unknown>>,
    inserts: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
}));

const queue = vi.hoisted(() => ({
    dispatchHomelabQueueSafely: vi.fn(async () => null),
    getHomelabQueuePosition: vi.fn(async () => null as number | null),
}));

// A tiny awaitable query-builder: rows are decided by the table passed to from()/insert()/update().
vi.mock('../db/index.js', async () => {
    const schema = await import('../db/schema.js');
    const rowsFor = (table: unknown): unknown[] => {
        if (table === schema.users) return state.user ? [state.user] : [];
        if (table === schema.searchHistory) return state.searchRow ? [state.searchRow] : [];
        return [];
    };
    const select = () => {
        let table: unknown;
        const chain: Record<string, unknown> = {
            from: (t: unknown) => {
                table = t;
                return chain;
            },
            ...Object.fromEntries(['where', 'leftJoin', 'orderBy', 'limit', 'offset', 'for', 'groupBy'].map((m) => [m, () => chain])),
            then: (resolve: (v: unknown) => unknown) => resolve(rowsFor(table)),
        };
        return chain;
    };
    return {
        db: {
            select,
            insert: () => ({
                values: (values: Record<string, unknown>) => {
                    state.inserts.push(values);
                    return { returning: () => Promise.resolve([{ id: 'search-1', ...values }]) };
                },
            }),
            update: () => ({
                set: (values: Record<string, unknown>) => {
                    state.updates.push(values);
                    const result = {
                        returning: () => Promise.resolve(state.updateReturning),
                        then: (resolve: (v: unknown) => unknown) => resolve([]),
                    };
                    return { where: () => result };
                },
            }),
            transaction: async () => {
                throw new Error('transaction not expected in these tests');
            },
        },
    };
});

vi.mock('../services/homelabQueue.js', () => queue);
vi.mock('../middleware/auth.js', () => ({
    requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = JSON.parse(String(req.headers['x-test-user']));
        next();
    },
}));
vi.mock('../middleware/userRateLimit.js', () => ({
    limitConcurrentSearches: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../services/creditRules.js', () => ({
    creditRulesService: { getUserCreditBalance: vi.fn(async () => ({ total: 1000 })), consumeCredits: vi.fn() },
}));
vi.mock('../services/autoTopUp.js', () => ({ autoTopUpService: { checkAndTrigger: vi.fn() } }));
vi.mock('../services/billingAlerts.js', () => ({
    billingAlertService: { sendTopUpSuccessAlert: vi.fn(), checkCreditAlerts: vi.fn() },
}));
vi.mock('../services/systemSettings.js', () => ({
    systemSettingsService: {
        getApifyConfig: vi.fn(async () => ({
            baseRunCostUsd: 0.005,
            minRunChargeUsd: 0.05,
            defaultSearchLanguage: 'en',
            defaultSearchCountryCode: 'us',
        })),
    },
}));
vi.mock('../utils/logger.js', () => ({
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../services/apify.js', () => ({
    startScrapingTask: vi.fn(async () => ({
        runId: 'apify-run-1',
        actorId: 'actor',
        actorName: 'Actor',
        scraperKey: 'standard',
        input: {},
        startOptions: {},
    })),
    getTaskStatus: vi.fn(),
    getTaskResults: vi.fn(),
    abortTask: vi.fn(),
    isApifyConfigured: vi.fn(() => true),
}));

import * as apify from '../services/apify.js';
import searchRouter, { syncSearchRecordState } from './search.js';

const SUPER_ADMIN: TestUser = { id: 'u-owner', email: 'Skale.Club@gmail.com ', role: 'admin' };
const OTHER_ADMIN: TestUser = { id: 'u-admin', email: 'other.admin@example.com', role: 'admin' };
const REGULAR_USER: TestUser = { id: 'u-user', email: 'user@example.com', role: 'user' };

const fetchMock = vi.fn();
const app = express();
app.use(express.json());
app.use('/api/search', searchRouter);

function as(user: TestUser) {
    state.user = { ...user, accountRiskFlag: null };
    return JSON.stringify(user);
}

function post(user: TestUser, body: Record<string, unknown>) {
    return request(app).post('/api/search').set('x-test-user', as(user)).send(body);
}

const homelabBody = { scrapeType: 'homelab', query: 'barber shop', location: 'Framingham, MA', maxResults: 30 };

function setHomelabEnv() {
    process.env.HOMELAB_SCRAPER_URL = 'https://scraper.example.net';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_ID = 'cid';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_SECRET = 'csecret';
}

function clearHomelabEnv() {
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('HOMELAB_SCRAPER_')) delete process.env[key];
    }
    delete process.env.SUPER_ADMIN_EMAIL;
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    state.user = null;
    state.searchRow = null;
    state.updateReturning = [{ id: 'search-1' }];
    state.inserts.length = 0;
    state.updates.length = 0;
    queue.dispatchHomelabQueueSafely.mockReset().mockResolvedValue(null);
    queue.getHomelabQueuePosition.mockReset().mockResolvedValue(null);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(apify.startScrapingTask).mockClear();
    clearHomelabEnv();
    setHomelabEnv();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearHomelabEnv();
});

describe('POST /api/search with the homelab scraper: owner-only gate (runs before any queueing)', () => {
    it('denies a regular user with 403 and queues nothing', async () => {
        const res = await post(REGULAR_USER, homelabBody);
        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(state.inserts).toHaveLength(0);
        expect(queue.dispatchHomelabQueueSafely).not.toHaveBeenCalled();
    });

    it('denies another admin with 403 (role admin is not enough) and queues nothing', async () => {
        const res = await post(OTHER_ADMIN, homelabBody);
        expect(res.status).toBe(403);
        expect(state.inserts).toHaveLength(0);
        expect(queue.dispatchHomelabQueueSafely).not.toHaveBeenCalled();
    });

    it('denies non-owners with 403 even when the homelab is not configured (no config probing)', async () => {
        clearHomelabEnv();
        const res = await post(OTHER_ADMIN, homelabBody);
        expect(res.status).toBe(403);
    });

    it('honours SUPER_ADMIN_EMAIL', async () => {
        process.env.SUPER_ADMIN_EMAIL = 'other.admin@example.com';
        state.searchRow = { id: 'search-1', status: 'queued' };
        expect((await post(OTHER_ADMIN, homelabBody)).status).toBe(202);
        expect((await post(SUPER_ADMIN, homelabBody)).status).toBe(403);
    });
});

describe('POST /api/search with the homelab scraper: queueing', () => {
    it('always enters the queue, then runs the dispatcher; an idle homelab starts it right away', async () => {
        state.searchRow = { id: 'search-1', status: 'running', apifyRunId: 'job-1' };

        const res = await post(SUPER_ADMIN, homelabBody);

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({
            searchId: 'search-1',
            apifyRunId: 'job-1',
            scrapeType: 'homelab',
            status: 'running',
            queued: false,
            queuePosition: null,
            creditsPerLead: 0,
            estimatedCredits: 0,
        });
        expect(state.inserts[0]).toMatchObject({ scrapeType: 'homelab', userId: 'u-owner', status: 'queued', query: 'barber shop', location: 'Framingham, MA' });
        expect(queue.dispatchHomelabQueueSafely).toHaveBeenCalledTimes(1);
        expect(apify.startScrapingTask).not.toHaveBeenCalled();
    });

    it('queues a second search instead of answering 409, without calling the homelab', async () => {
        // Dispatcher found the homelab busy: our row is still queued, two places back.
        state.searchRow = { id: 'search-1', status: 'queued', apifyRunId: null };
        queue.getHomelabQueuePosition.mockResolvedValue(2);

        const res = await post(SUPER_ADMIN, homelabBody);

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ searchId: 'search-1', status: 'queued', queued: true, queuePosition: 2, apifyRunId: null });
        expect(res.body.message).toMatch(/queued/i);
        expect(state.inserts[0]).toMatchObject({ status: 'queued' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 502 with the failure message when the dispatcher could not start the search (homelab unreachable)', async () => {
        state.searchRow = {
            id: 'search-1',
            status: 'failed',
            errorMessage: 'The homelab scraper is unavailable (HTTP 502). The search was not started. Try again later or use one of the Apify scrapers (Standard or Enriched).',
        };

        const res = await post(SUPER_ADMIN, homelabBody);

        expect(res.status).toBe(502);
        expect(res.body.message).toMatch(/homelab/i);
        expect(res.body.message).toMatch(/Apify scrapers/);
        expect(apify.startScrapingTask).not.toHaveBeenCalled();
    });

    it('returns a clear 503 when the homelab is not configured, never crashing', async () => {
        clearHomelabEnv();
        const res = await post(SUPER_ADMIN, homelabBody);
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/homelab scraper is not configured/i);
        expect(state.inserts).toHaveLength(0);
    });
});

describe('POST /api/search on the Apify path (unchanged)', () => {
    it('still starts a standard search through Apify for a regular user, bypassing the queue', async () => {
        const res = await post(REGULAR_USER, { scrapeType: 'standard', query: 'dentists', location: 'Boston, MA', maxResults: 50 });

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ apifyRunId: 'apify-run-1', scrapeType: 'standard' });
        expect(apify.startScrapingTask).toHaveBeenCalledWith('standard', expect.objectContaining({ query: 'dentists', location: 'Boston, MA', maxResults: 50 }));
        expect(state.inserts[0]).toMatchObject({ status: 'pending' });
        expect(queue.dispatchHomelabQueueSafely).not.toHaveBeenCalled();
        expect(state.updates.at(-1)).toMatchObject({ status: 'running', apifyRunId: 'apify-run-1' });
    });
});

describe('GET /api/search/scrapers', () => {
    const list = (user: TestUser) =>
        request(app).get('/api/search/scrapers').set('x-test-user', as(user));

    it('shows the homelab scraper to the super admin only', async () => {
        const owner = await list(SUPER_ADMIN);
        expect(owner.status).toBe(200);
        expect(owner.body.scrapers.map((s: { key: string }) => s.key)).toEqual(['standard', 'enriched', 'b2b_leads', 'homelab']);
        const homelab = owner.body.scrapers.find((s: { key: string }) => s.key === 'homelab');
        expect(homelab).toMatchObject({ label: 'Google Maps (Homelab)', source: 'google_maps', creditsPerResult: 0 });

        for (const other of [OTHER_ADMIN, REGULAR_USER]) {
            const res = await list(other);
            expect(res.status).toBe(200);
            expect(res.body.scrapers.map((s: { key: string }) => s.key)).toEqual(['standard', 'enriched', 'b2b_leads']);
        }
    });
});

describe('cancelling a queued homelab search (POST /:id/pause)', () => {
    const pause = (user: TestUser) =>
        request(app).post('/api/search/search-1/pause').set('x-test-user', as(user));
    const queuedRow = { id: 'search-1', userId: 'u-owner', status: 'queued', scrapeType: 'homelab', apifyRunId: null };

    it('lets the owner cancel it; the row becomes paused so the dispatcher never claims it', async () => {
        state.searchRow = queuedRow;

        const res = await pause(SUPER_ADMIN);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'paused', message: 'Queued search cancelled', partialLeadsSaved: 0, creditsCharged: 0 });
        expect(state.updates.at(-1)).toMatchObject({ status: 'paused', apifyStatusMessage: 'Cancelled while queued' });
    });

    it('refuses anyone who is not the owner', async () => {
        state.searchRow = { ...queuedRow, userId: 'u-admin' };
        const res = await pause(OTHER_ADMIN);
        expect(res.status).toBe(403);
        expect(state.updates).toHaveLength(0);
    });

    it('answers 409 when the dispatcher claimed it first (conditional update matched nothing)', async () => {
        state.searchRow = queuedRow;
        state.updateReturning = [];
        const res = await pause(SUPER_ADMIN);
        expect(res.status).toBe(409);
    });

    it('keeps refusing to pause a running homelab search', async () => {
        state.searchRow = { ...queuedRow, status: 'running', apifyRunId: 'job-1' };
        const res = await pause(SUPER_ADMIN);
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/cannot be paused/i);
        expect(state.updates).toHaveLength(0);
    });
});

describe('GET /api/search/history', () => {
    it('annotates queued homelab searches with their queue position', async () => {
        state.searchRow = { id: 'search-1', userId: 'u-owner', status: 'queued', scrapeType: 'homelab', apifyRunId: null, createdAt: new Date() };
        queue.getHomelabQueuePosition.mockResolvedValue(3);

        const res = await request(app).get('/api/search/history').set('x-test-user', as(SUPER_ADMIN));

        expect(res.status).toBe(200);
        expect(res.body.history[0]).toMatchObject({ id: 'search-1', status: 'queued', queuePosition: 3 });
    });
});

describe('syncSearchRecordState for homelab searches', () => {
    const now = Date.now();
    const baseRecord = {
        id: 'search-1',
        userId: 'u-owner',
        status: 'running',
        scrapeType: 'homelab',
        apifyRunId: 'job-1',
        createdAt: new Date(now - 60_000),
        apifyStartedAt: new Date(now - 60_000),
    } as unknown as Parameters<typeof syncSearchRecordState>[0];

    it('maps a working job to running and does not run the dispatcher', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 'working' }), { status: 200 }));
        const payload = await syncSearchRecordState(baseRecord, 'u-owner', true);
        expect(payload.status).toBe('running');
        expect(fetchMock.mock.calls[0][0]).toBe('https://scraper.example.net/api/v1/jobs/job-1');
        expect(queue.dispatchHomelabQueueSafely).not.toHaveBeenCalled();
    });

    it('fails the search with the engine status when the job reports failed, then runs the dispatcher', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 'failed' }), { status: 200 }));
        const payload = await syncSearchRecordState(baseRecord, 'u-owner', true);
        expect(payload.status).toBe('failed');
        const failed = state.updates.find((u) => u.status === 'failed');
        expect(failed).toMatchObject({
            errorMessage: 'Homelab scraper job failed (engine status: failed).',
            errorCode: 'HOMELAB_JOB_FAILED',
        });
        expect(queue.dispatchHomelabQueueSafely).toHaveBeenCalledTimes(1);
    });

    it('tolerates a transient poll error without failing the search', async () => {
        fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 }));
        const payload = await syncSearchRecordState(baseRecord, 'u-owner', true);
        expect(payload.status).toBe('running');
        expect(state.updates.find((u) => u.status === 'failed')).toBeUndefined();
        expect(queue.dispatchHomelabQueueSafely).not.toHaveBeenCalled();
    });

    it('fails a search whose job cannot be read past max_time plus the grace period, and frees the slot', async () => {
        fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 }));
        const overdue = {
            ...baseRecord,
            createdAt: new Date(now - 3 * 60 * 60 * 1000),
            apifyStartedAt: new Date(now - 3 * 60 * 60 * 1000),
        } as typeof baseRecord;

        const payload = await syncSearchRecordState(overdue, 'u-owner', true);

        expect(payload.status).toBe('failed');
        expect(state.updates.find((u) => u.status === 'failed')).toMatchObject({ errorCode: 'HOMELAB_JOB_TIMEOUT' });
        expect(queue.dispatchHomelabQueueSafely).toHaveBeenCalledTimes(1);
    });

    it('does not count time spent in the queue: old createdAt but a recent start is not overdue', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 'working' }), { status: 200 }));
        const waitedLong = {
            ...baseRecord,
            createdAt: new Date(now - 20 * 60 * 60 * 1000),
            apifyStartedAt: new Date(now - 60_000),
        } as typeof baseRecord;

        const payload = await syncSearchRecordState(waitedLong, 'u-owner', true);

        expect(payload.status).toBe('running');
        expect(state.updates.find((u) => u.status === 'failed')).toBeUndefined();
    });

    it('fails a search the engine still reports as working long past its deadline', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 'working' }), { status: 200 }));
        const overdue = {
            ...baseRecord,
            apifyStartedAt: new Date(now - 3 * 60 * 60 * 1000),
        } as typeof baseRecord;
        const payload = await syncSearchRecordState(overdue, 'u-owner', true);
        expect(payload.status).toBe('failed');
    });
});

describe('syncSearchRecordState for queued homelab searches', () => {
    const queuedRecord = {
        id: 'search-1',
        userId: 'u-owner',
        status: 'queued',
        scrapeType: 'homelab',
        apifyRunId: null,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        apifyStartedAt: null,
    } as unknown as Parameters<typeof syncSearchRecordState>[0];

    it('runs the dispatcher on read and reports status queued with the queue position while still waiting', async () => {
        state.searchRow = queuedRecord as unknown as Record<string, unknown>;
        queue.getHomelabQueuePosition.mockResolvedValue(2);

        const payload = await syncSearchRecordState(queuedRecord, 'u-owner', true);

        expect(queue.dispatchHomelabQueueSafely).toHaveBeenCalledTimes(1);
        expect(payload).toMatchObject({ status: 'queued', queuePosition: 2 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('never fails a long-queued search for the job deadline (the queue has its own 24h cap)', async () => {
        const waited = { ...queuedRecord, createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000) } as typeof queuedRecord;
        state.searchRow = waited as unknown as Record<string, unknown>;

        const payload = await syncSearchRecordState(waited, 'u-owner', true);

        expect(payload.status).toBe('queued');
        expect(state.updates.find((u) => u.status === 'failed')).toBeUndefined();
    });

    it('reports the new state when the dispatcher started it during the read', async () => {
        state.searchRow = { ...queuedRecord, status: 'running', apifyRunId: 'job-5', apifyStartedAt: new Date() } as unknown as Record<string, unknown>;
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 'pending' }), { status: 200 }));

        const payload = await syncSearchRecordState(queuedRecord, 'u-owner', true);

        expect(payload.status).toBe('pending');
        expect(fetchMock.mock.calls[0][0]).toBe('https://scraper.example.net/api/v1/jobs/job-5');
    });
});

describe('syncSearchRecordState for Apify searches (unchanged)', () => {
    it('keeps polling Apify with only the run id and tolerates an error', async () => {
        vi.mocked(apify.getTaskStatus).mockRejectedValueOnce(new Error('apify down'));
        const record = {
            id: 's2',
            userId: 'u-user',
            status: 'running',
            scrapeType: 'standard',
            apifyRunId: 'apify-run-1',
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            apifyStartedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        } as unknown as Parameters<typeof syncSearchRecordState>[0];

        const payload = await syncSearchRecordState(record, 'u-user', false);

        expect(apify.getTaskStatus).toHaveBeenCalledWith('apify-run-1');
        expect(payload.status).toBe('running');
        expect(state.updates).toHaveLength(0);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(queue.dispatchHomelabQueueSafely).not.toHaveBeenCalled();
    });
});
