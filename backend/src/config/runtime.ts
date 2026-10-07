/**
 * Hosting-mode switches. Xcraper runs either as a Vercel serverless function
 * (api/index.ts wraps createApp) or as a long-running Node process (src/index.ts,
 * the Docker image). Everything that differs between the two lives here.
 */

/** True inside Vercel / AWS Lambda style runtimes, where there is no writable app dir and no app.listen(). */
export function isServerless(): boolean {
    return process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function getPort(): number {
    const parsed = Number.parseInt(process.env.PORT ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3001;
}

/**
 * Express `trust proxy` setting. Default `1` (one proxy hop: Vercel's edge, or
 * Traefik directly in front of the container). Behind two hops, such as
 * Traefik -> nginx -> backend in docker-compose, set TRUST_PROXY=2 or the rate
 * limiter keys every visitor on the proxy's IP. Accepts a hop count, true/false,
 * or an Express subnet list (e.g. "loopback, 10.0.0.0/8").
 */
export function getTrustProxy(): number | boolean | string {
    const raw = (process.env.TRUST_PROXY ?? '').trim();
    if (!raw) return 1;
    if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
    if (raw.toLowerCase() === 'true') return true;
    if (raw.toLowerCase() === 'false') return false;
    return raw;
}
