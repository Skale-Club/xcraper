import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    HomelabError,
    downloadHomelabCsv,
    getHomelabConfig,
    getHomelabJobStatus,
    getHomelabJobSettings,
    isHomelabConfigured,
    mapHomelabStatus,
    parseCsv,
    startHomelabJob,
} from './homelab.js';

const SECRET = 'super-secret-value-123';

function setEnv() {
    process.env.HOMELAB_SCRAPER_URL = 'https://scraper.example.net/';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_ID = 'client-id-abc.access';
    process.env.HOMELAB_SCRAPER_CF_CLIENT_SECRET = SECRET;
}

function clearEnv() {
    for (const key of [
        'HOMELAB_SCRAPER_URL',
        'HOMELAB_SCRAPER_CF_CLIENT_ID',
        'HOMELAB_SCRAPER_CF_CLIENT_SECRET',
        'HOMELAB_SCRAPER_MAX_TIME_SECONDS',
        'HOMELAB_SCRAPER_DEPTH',
    ]) {
        delete process.env[key];
    }
}

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('homelab config', () => {
    beforeEach(clearEnv);
    afterEach(clearEnv);

    it('is unavailable when any of URL, client id or secret is missing', () => {
        expect(getHomelabConfig()).toBeNull();
        setEnv();
        expect(isHomelabConfigured()).toBe(true);
        for (const key of ['HOMELAB_SCRAPER_URL', 'HOMELAB_SCRAPER_CF_CLIENT_ID', 'HOMELAB_SCRAPER_CF_CLIENT_SECRET']) {
            const saved = process.env[key];
            delete process.env[key];
            expect(isHomelabConfigured()).toBe(false);
            process.env[key] = saved;
        }
    });

    it('normalises the base URL and rejects non-http URLs', () => {
        setEnv();
        expect(getHomelabConfig()?.baseUrl).toBe('https://scraper.example.net');
        process.env.HOMELAB_SCRAPER_URL = 'ftp://scraper.example.net';
        expect(getHomelabConfig()).toBeNull();
        process.env.HOMELAB_SCRAPER_URL = 'not a url';
        expect(getHomelabConfig()).toBeNull();
    });

    it('defaults max_time to 1800 and depth to 10, and ignores bad values', () => {
        expect(getHomelabJobSettings()).toEqual({ maxTimeSeconds: 1800, depth: 10 });
        process.env.HOMELAB_SCRAPER_MAX_TIME_SECONDS = '900';
        process.env.HOMELAB_SCRAPER_DEPTH = '5';
        expect(getHomelabJobSettings()).toEqual({ maxTimeSeconds: 900, depth: 5 });
        process.env.HOMELAB_SCRAPER_MAX_TIME_SECONDS = 'abc';
        process.env.HOMELAB_SCRAPER_DEPTH = '-2';
        expect(getHomelabJobSettings()).toEqual({ maxTimeSeconds: 1800, depth: 10 });
    });
});

describe('homelab client', () => {
    beforeEach(() => {
        clearEnv();
        setEnv();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        clearEnv();
    });

    it('starts a job with the payload, JSON content type and Cloudflare Access headers', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ id: 'job-uuid-1' }));
        const payload = { name: 'n', keywords: ['k'], lang: 'en', depth: 3, email: true, max_time: 600, fast_mode: false };

        await expect(startHomelabJob(payload)).resolves.toEqual({ id: 'job-uuid-1' });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://scraper.example.net/api/v1/jobs');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual(payload);
        expect(init.headers['CF-Access-Client-Id']).toBe('client-id-abc.access');
        expect(init.headers['CF-Access-Client-Secret']).toBe(SECRET);
        expect(init.headers['Content-Type']).toBe('application/json');
        expect(init.redirect).toBe('manual');
    });

    it('throws a clear not-configured error without calling fetch', async () => {
        delete process.env.HOMELAB_SCRAPER_URL;
        await expect(startHomelabJob({})).rejects.toMatchObject({ name: 'HomelabError', code: 'not_configured' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        ['network failure', () => fetchMock.mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })), /ECONNREFUSED/],
        ['5xx', () => fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 })), /HTTP 502/],
        ['Cloudflare 403', () => fetchMock.mockResolvedValue(new Response('forbidden', { status: 403 })), /Cloudflare Access.*403/],
        ['Cloudflare login redirect', () => fetchMock.mockResolvedValue(new Response(null, { status: 302 })), /Cloudflare Access.*302/],
    ])('reports an unreachable homelab on %s, naming Apify as the alternative and never leaking the secret', async (_name, arrange, pattern) => {
        arrange();
        const error = await startHomelabJob({}).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(HomelabError);
        const message = (error as HomelabError).message;
        expect(message).toMatch(/homelab/i);
        expect(message).toMatch(/Apify/);
        expect(message).toMatch(pattern);
        expect(message).not.toContain(SECRET);
    });

    it('rejects a response without a job id', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ nope: true }));
        await expect(startHomelabJob({})).rejects.toMatchObject({ code: 'bad_response' });
    });

    it('rejects a non-JSON body', async () => {
        fetchMock.mockResolvedValue(new Response('<html>login</html>', { status: 200 }));
        await expect(startHomelabJob({})).rejects.toMatchObject({ code: 'bad_response' });
    });

    it.each([
        ['pending', 'READY', 10],
        ['working', 'RUNNING', 50],
        ['ok', 'SUCCEEDED', 100],
        ['failed', 'FAILED', 0],
        ['something-new', 'RUNNING', 50],
    ])('maps engine status %s to %s', async (engine, expected, progress) => {
        fetchMock.mockResolvedValue(jsonResponse({ ID: 'j', Name: 'n', Date: 'd', Status: engine, Data: {} }));
        const status = await getHomelabJobStatus('j');
        expect(status.status).toBe(expected);
        expect(status.progress).toBe(progress);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://scraper.example.net/api/v1/jobs/j');
        expect(init.method).toBe('GET');
        expect(init.headers['CF-Access-Client-Secret']).toBe(SECRET);
    });

    it('describes a failed job with the engine status', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ Status: 'failed' }));
        const status = await getHomelabJobStatus('j');
        expect(status.statusMessage).toBe('Homelab scraper job failed (engine status: failed).');
    });

    it('throws on a poll error so the caller can retry on its next tick', async () => {
        fetchMock.mockResolvedValue(new Response('x', { status: 503 }));
        await expect(getHomelabJobStatus('j')).rejects.toBeInstanceOf(HomelabError);
    });

    it('downloads the CSV from the job download endpoint', async () => {
        fetchMock.mockResolvedValue(new Response('a,b\n1,2\n', { status: 200 }));
        await expect(downloadHomelabCsv('job 1')).resolves.toBe('a,b\n1,2\n');
        expect(fetchMock.mock.calls[0][0]).toBe('https://scraper.example.net/api/v1/jobs/job%201/download');
    });
});

describe('mapHomelabStatus', () => {
    it('is case-insensitive and defaults to running', () => {
        expect(mapHomelabStatus('OK').status).toBe('SUCCEEDED');
        expect(mapHomelabStatus(undefined).status).toBe('RUNNING');
    });
});

describe('parseCsv', () => {
    it('handles CRLF, BOM, quotes and a missing trailing newline', () => {
        const rows = parseCsv('﻿a,b\r\n"x,1","he said ""hi"""\r\nlast,row');
        expect(rows).toEqual([['a', 'b'], ['x,1', 'he said "hi"'], ['last', 'row']]);
    });

    it('drops blank lines', () => {
        expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
    });
});
