/**
 * Single source of truth for every absolute URL the backend builds or trusts.
 *
 * Nothing else in `backend/src` may hardcode a deployment domain. To move
 * Xcraper to another domain, change the env vars read here (see
 * docs/DOMAIN-CHANGE.md); `urls.config.test.ts` fails the build if a production
 * domain literal shows up anywhere outside this file.
 *
 * Every value is read lazily (on call, not at import time) so that `dotenv`
 * loading order and tests that mutate `process.env` behave predictably.
 *
 * Env vars:
 *   FRONTEND_URL          Public origin of the SPA (Stripe return URLs, CORS).
 *                         Default: http://localhost:5173
 *   BACKEND_URL           Public origin of the API (Apify webhook target).
 *                         Default: FRONTEND_URL in production (same-origin
 *                         deployments), http://localhost:$PORT otherwise.
 *   CORS_ALLOWED_ORIGINS  Optional comma-separated extra browser origins.
 *   XPHERE_API_URL        Xphere base URL. Default: https://xphere.app
 */

/** Production origin of Xphere, the prospecting hub Xcraper pushes leads to. */
export const DEFAULT_XPHERE_URL = 'https://xphere.app';

const DEFAULT_DEV_APP_URL = 'http://localhost:5173';
const DEFAULT_PORT = 3001;

/** Trim and drop trailing slashes. Empty / whitespace-only input becomes ''. */
export function normalizeBaseUrl(value: string | undefined | null): string {
    return (value ?? '').trim().replace(/\/+$/, '');
}

function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

/** Public origin of the web app (the SPA). Used for Stripe return URLs. */
export function getAppUrl(): string {
    return normalizeBaseUrl(process.env.FRONTEND_URL) || DEFAULT_DEV_APP_URL;
}

/** Absolute URL of a path on the web app, e.g. `/billing?checkout=success`. */
export function appUrl(path = ''): string {
    return `${getAppUrl()}${path.startsWith('/') || path === '' ? path : `/${path}`}`;
}

/**
 * Public origin of the API. In a same-origin deployment (Vercel today, or the
 * docker-compose nginx proxy) this is the app URL, so production falls back to
 * it when BACKEND_URL is unset.
 */
export function getApiUrl(): string {
    const explicit = normalizeBaseUrl(process.env.BACKEND_URL);
    if (explicit) return explicit;

    const frontend = normalizeBaseUrl(process.env.FRONTEND_URL);
    if (isProduction() && frontend) return frontend;

    return `http://localhost:${process.env.PORT || DEFAULT_PORT}`;
}

/** Absolute URL of a path on the API, e.g. `/api/webhooks/apify`. */
export function apiUrl(path = ''): string {
    return `${getApiUrl()}${path.startsWith('/') || path === '' ? path : `/${path}`}`;
}

/** URL Apify must call when a run finishes (configured in the Apify console). */
export function getApifyWebhookUrl(): string {
    return apiUrl('/api/webhooks/apify');
}

/** Reduce a configured URL to the bare `scheme://host[:port]` a browser sends as Origin. */
function toOrigin(value: string): string {
    try {
        return new URL(value).origin;
    } catch {
        return value;
    }
}

/**
 * Browser origins allowed by CORS.
 *
 * Production: FRONTEND_URL plus anything in CORS_ALLOWED_ORIGINS. When neither
 * is set the list is empty and cross-origin requests are refused (same-origin
 * requests never need CORS).
 * Elsewhere: the Vite dev server, plus CORS_ALLOWED_ORIGINS.
 */
export function getCorsOrigins(): string[] {
    const extra = (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map(normalizeBaseUrl)
        .filter(Boolean);

    const base = isProduction()
        ? [normalizeBaseUrl(process.env.FRONTEND_URL)]
        : [DEFAULT_DEV_APP_URL];

    return [...new Set([...base, ...extra].filter(Boolean).map(toOrigin))];
}

/**
 * Value for the `cors` middleware `origin` option. A single origin is passed as
 * a plain string so the response header stays exactly what it was before this
 * module existed; several origins are passed as a list (reflected per request).
 */
export function getCorsOriginOption(): string | string[] | false {
    const origins = getCorsOrigins();
    if (origins.length === 0) return false;
    return origins.length === 1 ? origins[0] : origins;
}

/** Xphere base URL (no trailing slash). Per-user `xphereApiUrl` still wins at the call sites. */
export function getXphereUrl(): string {
    return normalizeBaseUrl(process.env.XPHERE_API_URL) || DEFAULT_XPHERE_URL;
}
