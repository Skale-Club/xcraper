import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const state = vi.hoisted(() => ({
    serviceUser: null as Record<string, unknown> | null,
    searchRow: null as Record<string, unknown> | null,
    inserts: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
}));

vi.mock('../db/index.js', async () => {
    const schema = await import('../db/schema.js');
    const rowsFor = (table: unknown): unknown[] => {
        if (table === schema.users) return state.serviceUser ? [state.serviceUser] : [];
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
            ...Object.fromEntries(['where', 'orderBy', 'limit', 'for'].map((m) => [m, () => chain])),
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
                    return { where: () => Promise.resolve([]) };
                },
            }),
        },
    };
});
const queue = vi.hoisted(() => ({
    dispatchHomelabQueueSafely: vi.fn(async () => null),
    getHomelabQueuePosition: vi.fn(async () => null as number | null),
}));
vi.mock('../services/homelabQueue.js', () => queue);
vi.mock('./search.js', () => ({ syncSearchRecordState: vi.fn() }));
vi.mock('../services/xphere.js', () => ({ pushRunToXphere: vi.fn() }));
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
import { syncSearchRecordState } from './search.js';
import serviceRouter from './service.js';

const SERVICE_KEY = 'test-service-key';
const fetchMock = vi.fn();
const app = express();
app.use(express.json());
app.use('/api/service', serviceRouter);

const serviceUser = (email: string) => ({
    id: 'svc-user',
    email,
    role: 'admin',
    accountRiskFlag: null,
});

const scrape = (body: Record<string, unknown>) =>
    request(app).post('/api/service/scrape').set('x-service-key', SERVICE_KEY).send(body);

const homelabBody = { query: 'barber shop', location: 'Framingham, MA', maxResults: 30, scrapeType: 'homelab' };

function clearEnv() {
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('HOMELAB_SCRAPER_')) delete process.env[key];
    }
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.XCRAPER_SERVICE_KEY;
    delete process.env.XCRAPER_SERVICE_USER_EMAIL;
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    clearEnv();
    process.env.XCRAPER_SERVICE_KEY = SERVICE_KEY;
    process.env.XCRAPER_SERVICE_USER_EMAIL = 'hermes@example.com';
    process.env.HOMELAB_SCRAPER_URL = 'https://scraper.example.net';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_ID = 'cid';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_SECRET = 'csecret';
    state.serviceUser = null;
    state.searchRow = null;
    queue.dispatchHomelabQueueSafely.mockReset().mockResolvedValue(null);
    queue.getHomelabQueuePosition.mockReset().mockResolvedValue(null);
    state.inserts.length = 0;
    state.updates.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(apify.startScrapingTask).mockClear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
});

describe('POST /api/service/scrape with scrapeType homelab', () => {
    it('starts right away when the service user is the super admin and the homelab is idle', async () => {
        state.serviceUser = serviceUser('Skale.Club@gmail.com');
        state.searchRow = { id: 'search-1', status: 'running', apifyRunId: 'job-9' };

        const res = await scrape(homelabBody);

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ searchId: 'search-1', status: 'running', queued: false, queuePosition: null, scrapeType: 'homelab', apifyRunId: 'job-9' });
        expect(state.inserts[0]).toMatchObject({ scrapeType: 'homelab', userId: 'svc-user', status: 'queued' });
        expect(queue.dispatchHomelabQueueSafely).toHaveBeenCalledTimes(1);
    });

    it('queues instead of answering 409 when the homelab is busy, returning status queued and the position', async () => {
        state.serviceUser = serviceUser('skale.club@gmail.com');
        state.searchRow = { id: 'search-1', status: 'queued', apifyRunId: null };
        queue.getHomelabQueuePosition.mockResolvedValue(3);

        const res = await scrape(homelabBody);

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ searchId: 'search-1', status: 'queued', queued: true, queuePosition: 3, apifyRunId: null });
        expect(res.body.poll).toBe('/api/service/scrape/search-1');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is denied with 403 when the service user is another admin, before anything is queued', async () => {
        state.serviceUser = serviceUser('hermes@example.com');

        const res = await scrape(homelabBody);

        expect(res.status).toBe(403);
        expect(state.inserts).toHaveLength(0);
        expect(queue.dispatchHomelabQueueSafely).not.toHaveBeenCalled();
    });

    it('answers 502 naming the homelab when the dispatcher failed to start it', async () => {
        state.serviceUser = serviceUser('skale.club@gmail.com');
        state.searchRow = {
            id: 'search-1',
            status: 'failed',
            errorMessage: 'The homelab scraper is unavailable (network error). Try the Apify scrapers.',
        };

        const res = await scrape(homelabBody);

        expect(res.status).toBe(502);
        expect(res.body.message).toMatch(/homelab/i);
        expect(apify.startScrapingTask).not.toHaveBeenCalled();
    });

    it('answers 503 when the homelab is not configured', async () => {
        state.serviceUser = serviceUser('skale.club@gmail.com');
        delete process.env.HOMELAB_SCRAPER_URL;

        const res = await scrape(homelabBody);

        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/homelab scraper is not configured/i);
    });

    it('still requires the service key', async () => {
        const res = await request(app).post('/api/service/scrape').send(homelabBody);
        expect(res.status).toBe(401);
    });
});

describe('GET /api/service/scrape/:id for a queued run', () => {
    it('reports status queued with queuePosition', async () => {
        state.serviceUser = serviceUser('skale.club@gmail.com');
        state.searchRow = { id: 'search-1', userId: 'svc-user', status: 'queued', xpherePushedAt: null };
        vi.mocked(syncSearchRecordState).mockResolvedValue({ status: 'queued', queuePosition: 2 });

        const res = await request(app).get('/api/service/scrape/search-1').set('x-service-key', SERVICE_KEY);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ searchId: 'search-1', status: 'queued', queuePosition: 2, xphere: { pushed: false } });
    });

    it('reports a null queuePosition once the run is no longer queued', async () => {
        state.serviceUser = serviceUser('skale.club@gmail.com');
        state.searchRow = { id: 'search-1', userId: 'svc-user', status: 'running', xpherePushedAt: null };
        vi.mocked(syncSearchRecordState).mockResolvedValue({ status: 'running', progress: 50 });

        const res = await request(app).get('/api/service/scrape/search-1').set('x-service-key', SERVICE_KEY);

        expect(res.body).toMatchObject({ status: 'running', queuePosition: null });
    });
});

describe('POST /api/service/scrape on the Apify path (unchanged)', () => {
    it('keeps running standard scrapes through Apify for any service user', async () => {
        state.serviceUser = serviceUser('hermes@example.com');

        const res = await scrape({ query: 'dentists', location: 'Boston, MA', maxResults: 50 });

        expect(res.status).toBe(202);
        expect(res.body).toMatchObject({ scrapeType: 'standard', apifyRunId: 'apify-run-1' });
        expect(apify.startScrapingTask).toHaveBeenCalledWith('standard', expect.objectContaining({ query: 'dentists' }));
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
