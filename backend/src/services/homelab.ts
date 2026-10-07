import type { TaskStatus } from './apify.js';

/**
 * Client for the owner's homelab scraper: the open-source `gosom/google-maps-scraper`
 * engine running in web/API mode behind a Cloudflare Access application.
 *
 * Every request carries a Cloudflare Access service token (`CF-Access-Client-Id` /
 * `CF-Access-Client-Secret`). The secret is only ever placed in a request header; it is
 * never logged and never included in an error message.
 *
 * Engine API used:
 *   POST {base}/api/v1/jobs                 -> { id }
 *   GET  {base}/api/v1/jobs/{id}            -> { ID, Name, Date, Status, Data }
 *   GET  {base}/api/v1/jobs/{id}/download   -> CSV
 *
 * Job statuses are mapped onto the Apify run vocabulary (`READY`, `RUNNING`,
 * `SUCCEEDED`, `FAILED`) so the rest of the pipeline (sync, SSE, finalize) does not
 * need a second state machine.
 */

export const DEFAULT_MAX_TIME_SECONDS = 1800;
export const DEFAULT_DEPTH = 10;
/** Slack added on top of the engine's own max_time before we give up on a job. */
export const HOMELAB_OVERDUE_GRACE_MS = 10 * 60 * 1000;

const START_TIMEOUT_MS = 30_000;
const STATUS_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export type HomelabErrorCode =
    | 'not_configured'
    | 'unreachable'
    | 'rejected'
    | 'bad_response'
    | 'job_failed'
    | 'unsupported';

/** Error whose message is safe to show to the user (no secrets, no raw upstream bodies). */
export class HomelabError extends Error {
    readonly code: HomelabErrorCode;

    constructor(message: string, code: HomelabErrorCode) {
        super(message);
        this.name = 'HomelabError';
        this.code = code;
    }
}

export interface HomelabJobSettings {
    maxTimeSeconds: number;
    depth: number;
}

export interface HomelabConfig extends HomelabJobSettings {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
}

function positiveInt(value: string | undefined, fallback: number): number {
    if (value === undefined) return fallback;
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Job tuning knobs. Readable without credentials (used when building the job payload). */
export function getHomelabJobSettings(): HomelabJobSettings {
    return {
        maxTimeSeconds: positiveInt(process.env.HOMELAB_SCRAPER_MAX_TIME_SECONDS, DEFAULT_MAX_TIME_SECONDS),
        depth: positiveInt(process.env.HOMELAB_SCRAPER_DEPTH, DEFAULT_DEPTH),
    };
}

/** Full client config, or null when the URL or either Cloudflare credential is missing/invalid. */
export function getHomelabConfig(): HomelabConfig | null {
    const rawUrl = process.env.HOMELAB_SCRAPER_URL?.trim();
    const clientId = process.env.HOMELAB_SCRAPER_CF_CLIENT_ID?.trim();
    const clientSecret = process.env.HOMELAB_SCRAPER_CF_CLIENT_SECRET?.trim();
    if (!rawUrl || !clientId || !clientSecret) return null;

    let baseUrl: string;
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        baseUrl = parsed.toString().replace(/\/+$/, '');
    } catch {
        return null;
    }

    return { baseUrl, clientId, clientSecret, ...getHomelabJobSettings() };
}

export function isHomelabConfigured(): boolean {
    return getHomelabConfig() !== null;
}

export const HOMELAB_NOT_CONFIGURED_MESSAGE =
    'The homelab scraper is not configured on this server (set HOMELAB_SCRAPER_URL, HOMELAB_SCRAPER_CF_CLIENT_ID and HOMELAB_SCRAPER_CF_CLIENT_SECRET).';

function requireConfig(): HomelabConfig {
    const config = getHomelabConfig();
    if (!config) throw new HomelabError(HOMELAB_NOT_CONFIGURED_MESSAGE, 'not_configured');
    return config;
}

function unreachableMessage(reason: string): string {
    return `The homelab scraper is unavailable (${reason}). The search was not started. Try again later or use one of the Apify scrapers (Standard or Enriched).`;
}

function describeNetworkError(error: unknown): string {
    if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'request timed out';
        const cause = (error as Error & { cause?: { code?: string } }).cause;
        if (cause?.code) return `network error ${cause.code}`;
        return 'network error';
    }
    return 'network error';
}

async function homelabRequest(
    config: HomelabConfig,
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs: number },
): Promise<Response> {
    const headers: Record<string, string> = {
        Accept: 'application/json, text/csv',
        'CF-Access-Client-Id': config.clientId,
        'CF-Access-Client-Secret': config.clientSecret,
    };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
        response = await fetch(`${config.baseUrl}${path}`, {
            method: init.method,
            headers,
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
            // Cloudflare Access answers a rejected token with a redirect to its login
            // page; following it would hand us a 200 HTML page. Surface it instead.
            redirect: 'manual',
            signal: AbortSignal.timeout(init.timeoutMs),
        });
    } catch (error) {
        throw new HomelabError(unreachableMessage(describeNetworkError(error)), 'unreachable');
    }

    if ((response.status >= 300 && response.status < 400) || response.status === 401 || response.status === 403) {
        throw new HomelabError(
            unreachableMessage(`Cloudflare Access rejected the request, HTTP ${response.status}; check the service token`),
            'rejected',
        );
    }
    if (!response.ok) {
        throw new HomelabError(unreachableMessage(`HTTP ${response.status}`), 'unreachable');
    }
    return response;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    try {
        const parsed: unknown = await response.json();
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // fall through
    }
    throw new HomelabError(
        'The homelab scraper returned an unexpected response (not JSON).',
        'bad_response',
    );
}

/**
 * Create a scrape job. Like starting an Apify actor this is NOT retried: a dropped
 * response after the job was actually queued would otherwise queue a second one on a
 * machine that runs exactly one job at a time.
 */
export async function startHomelabJob(payload: Record<string, unknown>): Promise<{ id: string }> {
    const config = requireConfig();
    const response = await homelabRequest(config, '/api/v1/jobs', {
        method: 'POST',
        body: payload,
        timeoutMs: START_TIMEOUT_MS,
    });
    const json = await readJson(response);
    const id = typeof json.id === 'string' ? json.id : typeof json.ID === 'string' ? json.ID : '';
    if (!id) {
        throw new HomelabError(
            'The homelab scraper did not return a job id. The search was not started.',
            'bad_response',
        );
    }
    return { id };
}

/** Map the engine's job status onto the Apify run vocabulary used by the pipeline. */
export function mapHomelabStatus(rawStatus: unknown): Pick<TaskStatus, 'status' | 'progress'> {
    const status = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
    switch (status) {
        case 'pending':
            return { status: 'READY', progress: 10 };
        case 'ok':
            return { status: 'SUCCEEDED', progress: 100 };
        case 'failed':
            return { status: 'FAILED', progress: 0 };
        case 'working':
        default:
            // An unknown status is treated as still running; the overdue bound in the
            // sync path stops a job stuck in a state we do not understand.
            return { status: 'RUNNING', progress: 50 };
    }
}

export async function getHomelabJobStatus(jobId: string): Promise<TaskStatus> {
    const config = requireConfig();
    const response = await homelabRequest(config, `/api/v1/jobs/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        timeoutMs: STATUS_TIMEOUT_MS,
    });
    const json = await readJson(response);
    const rawStatus = json.Status ?? json.status;
    const mapped = mapHomelabStatus(rawStatus);

    return {
        ...mapped,
        itemsCount: 0,
        statusMessage: mapped.status === 'FAILED'
            ? `Homelab scraper job failed (engine status: ${String(rawStatus)}).`
            : undefined,
    };
}

export async function downloadHomelabCsv(jobId: string): Promise<string> {
    const config = requireConfig();
    const response = await homelabRequest(config, `/api/v1/jobs/${encodeURIComponent(jobId)}/download`, {
        method: 'GET',
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
    return response.text();
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, embedded newlines, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
    const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (inQuotes) {
            if (ch === '"') {
                if (input[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && input[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
        } else {
            field += ch;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim().length > 0));
}

/** Parse the engine's CSV into one object per data row, keyed by the header names. */
export function parseHomelabCsv(text: string): Record<string, string>[] {
    const [header, ...rows] = parseCsv(text);
    if (!header) return [];
    const keys = header.map((h) => h.trim());
    return rows.map((cells) => {
        const record: Record<string, string> = {};
        keys.forEach((key, idx) => {
            record[key] = cells[idx] ?? '';
        });
        return record;
    });
}
