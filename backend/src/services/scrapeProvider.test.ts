import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.js', () => ({ db: { select: () => ({ from: () => Promise.resolve([]) }) } }));
vi.mock('./systemSettings.js', () => ({
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
vi.mock('./apify.js', () => ({
    startScrapingTask: vi.fn(async () => ({ runId: 'apify-run' })),
    getTaskStatus: vi.fn(async () => ({ status: 'RUNNING', progress: 50, itemsCount: 3 })),
    getTaskResults: vi.fn(async () => []),
    abortTask: vi.fn(async () => undefined),
    isApifyConfigured: vi.fn(() => true),
}));

import * as apify from './apify.js';
import {
    abortTask,
    getScraperProvider,
    getTaskResults,
    getTaskStatus,
    isScraperProviderConfigured,
    startScrapingTask,
} from './scrapeProvider.js';
import { isHomelabSearchOverdue } from './homelabBusy.js';

const here = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(here, 'scrapers', 'templates', '__fixtures__', 'homelab-sample.csv'), 'utf-8');
const fetchMock = vi.fn();

function clearEnv() {
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('HOMELAB_SCRAPER_')) delete process.env[key];
    }
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    clearEnv();
    process.env.HOMELAB_SCRAPER_URL = 'https://scraper.example.net';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_ID = 'cid';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_SECRET = 'csecret';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(apify.startScrapingTask).mockClear();
    vi.mocked(apify.getTaskStatus).mockClear();
    vi.mocked(apify.getTaskResults).mockClear();
    vi.mocked(apify.abortTask).mockClear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearEnv();
});

describe('provider selection', () => {
    it('runs standard, enriched and b2b_leads on Apify and homelab on the homelab', () => {
        expect(getScraperProvider('standard')).toBe('apify');
        expect(getScraperProvider('enriched')).toBe('apify');
        expect(getScraperProvider('b2b_leads')).toBe('apify');
        expect(getScraperProvider('homelab')).toBe('homelab');
        expect(getScraperProvider('does-not-exist')).toBe('apify');
    });

    it('checks the provider that the template actually uses', () => {
        expect(isScraperProviderConfigured('standard')).toBe(true);
        expect(isScraperProviderConfigured('homelab')).toBe(true);
        delete process.env.HOMELAB_SCRAPER_CF_CLIENT_SECRET;
        expect(isScraperProviderConfigured('homelab')).toBe(false);
        expect(isScraperProviderConfigured('standard')).toBe(true);
    });
});

describe('Apify path delegates unchanged', () => {
    it('forwards start, status, results and abort to services/apify.ts with the same arguments', async () => {
        const params = { maxResults: 50, language: '', countryCode: '', query: 'q', location: 'l' };

        await startScrapingTask('standard', params);
        await getTaskStatus('run-1', 'enriched');
        await getTaskResults('run-1', 'enriched', 25);
        await abortTask('run-1', 'standard');

        expect(apify.startScrapingTask).toHaveBeenCalledWith('standard', params);
        expect(apify.getTaskStatus).toHaveBeenCalledWith('run-1');
        expect(apify.getTaskResults).toHaveBeenCalledWith('run-1', 'enriched', 25);
        expect(apify.abortTask).toHaveBeenCalledWith('run-1');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('homelab path', () => {
    it('starts a job and returns it as a task, capped at the template maximum', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'job-7' }), { status: 200 }));

        const task = await startScrapingTask('homelab', {
            maxResults: 5000,
            language: '',
            countryCode: '',
            query: 'barber shop',
            location: 'Framingham, MA',
        });

        expect(task).toMatchObject({
            runId: 'job-7',
            scraperKey: 'homelab',
            actorName: 'Google Maps Scraper (Homelab)',
            input: expect.objectContaining({ keywords: ['barber shop in Framingham, MA'], lang: 'en' }),
        });
        expect(task.startedAt).toBeInstanceOf(Date);
        expect(apify.startScrapingTask).not.toHaveBeenCalled();
    });

    it('polls the homelab and never touches Apify', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ Status: 'ok' }), { status: 200 }));
        const status = await getTaskStatus('job-7', 'homelab');
        expect(status.status).toBe('SUCCEEDED');
        expect(apify.getTaskStatus).not.toHaveBeenCalled();
    });

    it('downloads the CSV and maps every row, applying the limit', async () => {
        fetchMock.mockImplementation(async () => new Response(csv, { status: 200 }));

        const all = await getTaskResults('job-7', 'homelab');
        expect(all.map((c) => c.title)).toEqual(['Barber One', 'No Mail Cuts, Inc.', 'The "Fade" Room']);
        expect(all.map((c) => c.dedupeKey)).toEqual(['ChIJbarberone', 'ChIJnomail', 'cid:55']);
        expect(all.filter((c) => c.email).length).toBe(2);

        const limited = await getTaskResults('job-7', 'homelab', 2);
        expect(limited).toHaveLength(2);
        expect(apify.getTaskResults).not.toHaveBeenCalled();
    });

    it('refuses to abort, since the engine has no abort', async () => {
        await expect(abortTask('job-7', 'homelab')).rejects.toMatchObject({ code: 'unsupported' });
        expect(apify.abortTask).not.toHaveBeenCalled();
    });

    it('throws a not-configured error before any network call', async () => {
        delete process.env.HOMELAB_SCRAPER_URL;
        await expect(
            startScrapingTask('homelab', { maxResults: 5, language: '', countryCode: '', query: 'a b', location: 'c d' }),
        ).rejects.toMatchObject({ code: 'not_configured' });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('isHomelabSearchOverdue', () => {
    const now = new Date('2026-10-07T12:00:00Z');

    it('is false inside max_time plus the grace period and true beyond it', () => {
        // default max_time 1800s + 10 min grace = 40 min
        expect(isHomelabSearchOverdue({ apifyStartedAt: new Date('2026-10-07T11:30:00Z'), createdAt: new Date('2026-10-07T11:30:00Z') }, now)).toBe(false);
        expect(isHomelabSearchOverdue({ apifyStartedAt: new Date('2026-10-07T11:10:00Z'), createdAt: new Date('2026-10-07T11:10:00Z') }, now)).toBe(true);
    });

    it('falls back to createdAt when the job never recorded a start', () => {
        expect(isHomelabSearchOverdue({ apifyStartedAt: null, createdAt: new Date('2026-10-07T09:00:00Z') }, now)).toBe(true);
    });
});
