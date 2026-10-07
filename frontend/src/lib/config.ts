/**
 * Single source of truth for the deployment-specific URLs the SPA uses.
 * Nothing else in `frontend/src` may hardcode a deployment domain; see
 * docs/DOMAIN-CHANGE.md. `VITE_*` values are baked in at build time, so a
 * change needs a rebuild (a Docker build arg in the self-hosted setup).
 *
 *   VITE_API_URL  Origin of the backend API, e.g. https://api.example.com.
 *                 Leave empty when the API is served from the same origin as
 *                 the SPA (Vercel rewrites, or the nginx proxy in
 *                 docker-compose); requests then go to relative /api/... paths.
 *   VITE_APP_URL  Public origin of the SPA. Optional: defaults to the origin
 *                 the browser actually loaded the page from, which is right
 *                 for every deployment that is not behind an alias.
 */

function clean(value: string | undefined): string {
    return (value ?? '').trim().replace(/\/+$/, '');
}

/** Backend origin, or '' when the API shares the SPA's origin. */
export function getApiBaseUrl(): string {
    return clean(import.meta.env.VITE_API_URL);
}

/** Public origin of the SPA, used for OAuth/password-reset redirects and absolute asset URLs. */
export function getAppOrigin(): string {
    return clean(import.meta.env.VITE_APP_URL) || window.location.origin;
}

/** Host (with port) of the SPA, for display purposes. */
export function getAppHost(): string {
    try {
        return new URL(getAppOrigin()).host;
    } catch {
        return window.location.host;
    }
}

/** Absolute URL of a path on the SPA, e.g. `/auth/callback`. */
export function appUrl(path = ''): string {
    return `${getAppOrigin()}${path === '' || path.startsWith('/') ? path : `/${path}`}`;
}
