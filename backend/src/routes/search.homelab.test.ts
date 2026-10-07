import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

type TestUser = { id: string; email: string; role: 'user' | 'admin'; accountRiskFlag?: null };

const state = vi.hoisted(() => ({
    user: null as Record<string, unknown> | null,
    homelabBusy: false,
    inserts: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
}));

// A tiny awaitable query-builder: rows are decided by the table passed to from()/insert()/update().
vi.mock('../db/index.js', async () => {
    const schema = await import('../db/schema.js');
    const rowsFor = (table: unknown): unknown[] => {
        if (table === schema.users) return state.user ? [state.user] : [];
        if (table === schema.searchHistory) return state.homelabBusy ? [{ id: 'busy-1' }] : [];
        return [];
    };
    const thenable = (rows: () => unknown[]) => ({ then: (resolve: (v: unknown) => unknown) => resolve(rows()) });
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
                    return { where: () => thenable(() => []) };
                },
            }),
            transaction: async () => {
                throw new Error('transaction not expected in these tests');
            },
        },
    };
});

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
    state.homelabBusy = false;
    state.inserts.length = 0;
    state.updates.length = 0;
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

describe('POST /api/search with the homelab scraper: owner-only gate', () => {
    it('denies a regular user with 403 and starts nothing', async () => {
        const res = await post(REGULAR_USER, homelabBody);
        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(state.inserts).toHaveLength(0);
    });

    it('denies another admin with 403 (role admin is not enough)', async () => {
        const res = await post(OTHER_ADMIN, homelabBody);
        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(state.inserts).toHaveLength(0);
    });

    it('denies non-owners with 403 even when the homelab is not configured (no config probing)', async () => {
        clearHomelabEnv();
        const res = await post(OTHER_ADMIN, homelabBody);
        expect(res.status).toBe(403);
    });

    it('allows the super admin (case and whitespace insensitive) and creates the homelab job', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'job-1' }), { status: 200 }));

        const res = await post(SUPER_ADMIN, homelabBody);

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ searchId: 'search-1', apifyRunId: 'job-1', scrapeType: 'homelab', creditsPerLead: 0, estimatedCredits: 0 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://scraper.example.net/api/v1/jobs');
        expect(init.headers['CF-Access-Client-Id']).toBe('cid');
        expect(init.headers['CF-Access-Client-Secret']).toBe('csecret');
        expect(JSON.parse(init.body)).toMatchObject({ keywords: ['barber shop in Framingham, MA'], email: true, depth: 10, max_time: 1800 });
        expect(state.inserts[0]).toMatchObject({ scrapeType: 'homelab', userId: 'u-owner', status: 'pending' });
        expect(state.updates.at(-1)).toMatchObject({ status: 'running', apifyRunId: 'job-1' });
        expect(apify.startScrapingTask).not.toHaveBeenCalled();
    });

    it('honours SUPER_ADMIN_EMAIL', async () => {
        process.env.SUPER_ADMIN_EMAIL = 'other.admin@example.com';
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'job-2' }), { status: 200 }));
        expect((await post(OTHER_ADMIN, homelabBody)).status).toBe(202);
        expect((await post(SUPER_ADMIN, homelabBody)).status).toBe(403);
    });
});

describe('POST /api/search with the homelab scraper: availability', () => {
    it('returns 409 while another homelab search is pending/running, without creating a record', async () => {
        state.homelabBusy = true;
        const res = await post(SUPER_ADMIN, homelabBody);
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('The homelab scraper is busy with another search; try again in a few minutes.');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(state.inserts).toHaveLength(0);
    });

    it('returns a clear 503 when the homelab is not configured, never crashing', async () => {
        clearHomelabEnv();
        const res = await post(SUPER_ADMIN, homelabBody);
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/homelab scraper is not configured/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        ['network error', () => fetchMock.mockRejectedValue(new TypeError('fetch failed'))],
        ['server error', () => fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))],
        ['Cloudflare 403', () => fetchMock.mockResolvedValue(new Response('denied', { status: 403 }))],
    ])('fails the search with a homelab message on %s and does not fall back to Apify', async (_name, arrange) => {
        arrange();

        const res = await post(SUPER_ADMIN, homelabBody);

        expect(res.status).toBe(502);
        expect(res.body.message).toMatch(/homelab/i);
        expect(res.body.message).toMatch(/Apify scrapers/);
        const failed = state.updates.find((u) => u.status === 'failed');
        expect(failed).toBeDefined();
        expect(String(failed?.errorMessage)).toMatch(/homelab/i);
        expect(String(failed?.errorMessage)).toMatch(/Apify/);
        expect(String(failed?.errorMessage)).not.toContain('csecret');
        expect(apify.startScrapingTask).not.toHaveBeenCalled();
    });
});

describe('POST /api/search on the Apify path (unchanged)', () => {
    it('still starts a standard search through Apify for a regular user', async () => {
        const res = await post(REGULAR_USER, { scrapeType: 'standard', query: 'dentists', location: 'Boston, MA', maxResults: 50 });

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ apifyRunId: 'apify-run-1', scrapeType: 'standard' });
        expect(apify.startScrapingTask).toHaveBeenCalledWith('standard', expect.objectContaining({ query: 'dentists', location: 'Boston, MA', maxResults: 50 }));
        expect(fetchMock).not.toHaveBeenCalled();
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

    it('maps a working job to running', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 'working' }), { status: 200 }));
        const payload = await syncSearchRecordState(baseRecord, 'u-owner', true);
        expect(payload.status).toBe('running');
        expect(fetchMock.mock.calls[0][0]).toBe('https://scraper.example.net/api/v1/jobs/job-1');
    });

    it('fails the search with the engine status when the job reports failed', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 'failed' }), { status: 200 }));
        const payload = await syncSearchRecordState(baseRecord, 'u-owner', true);
        expect(payload.status).toBe('failed');
        const failed = state.updates.find((u) => u.status === 'failed');
        expect(failed).toMatchObject({
            errorMessage: 'Homelab scraper job failed (engine status: failed).',
            errorCode: 'HOMELAB_JOB_FAILED',
        });
    });

    it('tolerates a transient poll error without failing the search', async () => {
        fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 }));
        const payload = await syncSearchRecordState(baseRecord, 'u-owner', true);
        expect(payload.status).toBe('running');
        expect(state.updates.find((u) => u.status === 'failed')).toBeUndefined();
    });

    it('fails a search whose job cannot be read past max_time plus the grace period', async () => {
        fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 }));
        const overdue = {
            ...baseRecord,
            createdAt: new Date(now - 3 * 60 * 60 * 1000),
            apifyStartedAt: new Date(now - 3 * 60 * 60 * 1000),
        } as typeof baseRecord;

        const payload = await syncSearchRecordState(overdue, 'u-owner', true);

        expect(payload.status).toBe('failed');
        expect(state.updates.find((u) => u.status === 'failed')).toMatchObject({ errorCode: 'HOMELAB_JOB_TIMEOUT' });
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
    });
});
