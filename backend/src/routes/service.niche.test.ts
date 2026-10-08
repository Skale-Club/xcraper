import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const state = vi.hoisted(() => ({
    serviceUser: null as Record<string, unknown> | null,
    searchRow: null as Record<string, unknown> | null,
    inserts: [] as Array<Record<string, unknown>>,
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
            update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
        },
    };
});
vi.mock('../services/homelabQueue.js', () => ({
    dispatchHomelabQueueSafely: vi.fn(async () => null),
    getHomelabQueuePosition: vi.fn(async () => null),
}));
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

import serviceRouter from './service.js';

const SERVICE_KEY = 'test-service-key';
const app = express();
app.use(express.json());
app.use('/api/service', serviceRouter);

const scrape = (body: Record<string, unknown>) =>
    request(app).post('/api/service/scrape').set('x-service-key', SERVICE_KEY).send(body);

const baseBody = { query: 'barber shop', location: 'Framingham, MA', maxResults: 30, scrapeType: 'homelab' };

function clearEnv() {
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('HOMELAB_SCRAPER_')) delete process.env[key];
    }
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.XCRAPER_SERVICE_KEY;
    delete process.env.XCRAPER_SERVICE_KEYS;
    delete process.env.XCRAPER_SERVICE_USER_EMAIL;
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    clearEnv();
    process.env.XCRAPER_SERVICE_KEY = SERVICE_KEY;
    process.env.XCRAPER_SERVICE_USER_EMAIL = 'skale.club@gmail.com';
    process.env.HOMELAB_SCRAPER_URL = 'https://scraper.example.net';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_ID = 'cid';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_SECRET = 'csecret';
    state.serviceUser = { id: 'svc-user', email: 'skale.club@gmail.com', role: 'admin', accountRiskFlag: null };
    state.searchRow = { id: 'search-1', status: 'running', apifyRunId: 'job-9' };
    state.inserts.length = 0;
});

afterEach(() => {
    vi.restoreAllMocks();
    clearEnv();
});

describe('POST /api/service/scrape niche', () => {
    it.each(['barbershop', 'nail_salon', 'hair_salon'])('accepts the slug %s and persists it on searchFilters', async (niche) => {
        const res = await scrape({ ...baseBody, niche });

        expect(res.status).toBe(202);
        expect(state.inserts[0].searchFilters).toEqual({ niche });
    });

    it('stores the niche next to the hypothesis without dropping either', async () => {
        const hypothesis = { premise: 'Barbershops need booking' };
        const res = await scrape({ ...baseBody, niche: 'barbershop', hypothesis });

        expect(res.status).toBe(202);
        expect(state.inserts[0].searchFilters).toEqual({ niche: 'barbershop', journey_hypothesis: hypothesis });
    });

    it('trims whitespace around the slug', async () => {
        const res = await scrape({ ...baseBody, niche: ' barbershop ' });

        expect(res.status).toBe(202);
        expect(state.inserts[0].searchFilters).toEqual({ niche: 'barbershop' });
    });

    it.each(['Barbershop', 'nail salon', 'nail-salon', 'x', 'a'.repeat(41), '_nail', 'barber__shop', '', 7])(
        'rejects %j with 400 before anything is inserted',
        async (niche) => {
            const res = await scrape({ ...baseBody, niche });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
            expect(JSON.stringify(res.body.details)).toMatch(/niche/);
            expect(state.inserts).toHaveLength(0);
        },
    );

    it('leaves the niche absent when not sent: it is never guessed from the query', async () => {
        const res = await scrape({ ...baseBody, query: 'barbershop' });

        expect(res.status).toBe(202);
        expect(state.inserts[0].searchFilters).toBeNull();
    });

    it('treats an explicit null niche as absent', async () => {
        const res = await scrape({ ...baseBody, niche: null });

        expect(res.status).toBe(202);
        expect(state.inserts[0].searchFilters).toBeNull();
    });

    it('keeps the hypothesis-only shape unchanged when there is no niche', async () => {
        const hypothesis = { premise: 'p' };
        const res = await scrape({ ...baseBody, hypothesis });

        expect(res.status).toBe(202);
        expect(state.inserts[0].searchFilters).toEqual({ journey_hypothesis: hypothesis });
    });
});
