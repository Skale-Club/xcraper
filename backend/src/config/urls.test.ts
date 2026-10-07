import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_XPHERE_URL,
    appUrl,
    apiUrl,
    getApifyWebhookUrl,
    getAppUrl,
    getApiUrl,
    getCorsOriginOption,
    getCorsOrigins,
    getXphereUrl,
    normalizeBaseUrl,
} from './urls.js';
import { getPort, getTrustProxy, isServerless } from './runtime.js';

const VARS = [
    'FRONTEND_URL', 'BACKEND_URL', 'CORS_ALLOWED_ORIGINS', 'XPHERE_API_URL',
    'NODE_ENV', 'PORT', 'TRUST_PROXY', 'VERCEL', 'AWS_LAMBDA_FUNCTION_NAME',
] as const;

beforeEach(() => {
    for (const name of VARS) vi.stubEnv(name, '');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('normalizeBaseUrl', () => {
    it('trims whitespace and trailing slashes', () => {
        expect(normalizeBaseUrl('  https://a.example///  ')).toBe('https://a.example');
    });

    it('turns nullish and blank input into an empty string', () => {
        expect(normalizeBaseUrl(undefined)).toBe('');
        expect(normalizeBaseUrl(null)).toBe('');
        expect(normalizeBaseUrl('   ')).toBe('');
    });
});

describe('app URL', () => {
    it('defaults to the Vite dev server', () => {
        expect(getAppUrl()).toBe('http://localhost:5173');
    });

    it('comes from FRONTEND_URL', () => {
        vi.stubEnv('FRONTEND_URL', 'https://app.example.test/');
        expect(getAppUrl()).toBe('https://app.example.test');
        expect(appUrl('/billing')).toBe('https://app.example.test/billing');
        expect(appUrl('billing')).toBe('https://app.example.test/billing');
    });

    it('keeps the Stripe session placeholder literal', () => {
        vi.stubEnv('FRONTEND_URL', 'https://app.example.test');
        expect(appUrl('/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}')).toBe(
            'https://app.example.test/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        );
    });
});

describe('API URL', () => {
    it('defaults to localhost on PORT outside production', () => {
        expect(getApiUrl()).toBe('http://localhost:3001');
        vi.stubEnv('PORT', '4000');
        expect(getApiUrl()).toBe('http://localhost:4000');
    });

    it('prefers BACKEND_URL', () => {
        vi.stubEnv('BACKEND_URL', 'https://api.example.test/');
        vi.stubEnv('FRONTEND_URL', 'https://app.example.test');
        vi.stubEnv('NODE_ENV', 'production');
        expect(getApiUrl()).toBe('https://api.example.test');
        expect(getApifyWebhookUrl()).toBe('https://api.example.test/api/webhooks/apify');
        expect(apiUrl('/api/health')).toBe('https://api.example.test/api/health');
    });

    it('falls back to the app URL in production (same-origin deployments)', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('FRONTEND_URL', 'https://app.example.test');
        expect(getApiUrl()).toBe('https://app.example.test');
    });
});

describe('CORS origins', () => {
    it('allows only the dev server outside production', () => {
        vi.stubEnv('FRONTEND_URL', 'https://app.example.test');
        expect(getCorsOrigins()).toEqual(['http://localhost:5173']);
        expect(getCorsOriginOption()).toBe('http://localhost:5173');
    });

    it('allows FRONTEND_URL in production, as a plain string for a single origin', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('FRONTEND_URL', 'https://app.example.test/');
        expect(getCorsOriginOption()).toBe('https://app.example.test');
    });

    it('adds CORS_ALLOWED_ORIGINS, de-duplicated and reduced to origins', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('FRONTEND_URL', 'https://app.example.test');
        vi.stubEnv('CORS_ALLOWED_ORIGINS', ' https://old.example.test/ , https://app.example.test/path ,');
        expect(getCorsOrigins()).toEqual(['https://app.example.test', 'https://old.example.test']);
        expect(getCorsOriginOption()).toEqual(['https://app.example.test', 'https://old.example.test']);
    });

    it('refuses cross-origin requests when production has no origin configured', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(getCorsOriginOption()).toBe(false);
    });
});

describe('Xphere URL', () => {
    it('defaults to the canonical Xphere origin', () => {
        expect(getXphereUrl()).toBe(DEFAULT_XPHERE_URL);
    });

    it('is overridable from XPHERE_API_URL', () => {
        vi.stubEnv('XPHERE_API_URL', 'https://xphere.example.test/');
        expect(getXphereUrl()).toBe('https://xphere.example.test');
    });
});

describe('runtime switches', () => {
    it('detects serverless runtimes', () => {
        expect(isServerless()).toBe(false);
        vi.stubEnv('VERCEL', '1');
        expect(isServerless()).toBe(true);
    });

    it('parses PORT with a safe fallback', () => {
        expect(getPort()).toBe(3001);
        vi.stubEnv('PORT', '9000');
        expect(getPort()).toBe(9000);
        vi.stubEnv('PORT', 'nonsense');
        expect(getPort()).toBe(3001);
    });

    it('defaults trust proxy to one hop and parses overrides', () => {
        expect(getTrustProxy()).toBe(1);
        vi.stubEnv('TRUST_PROXY', '2');
        expect(getTrustProxy()).toBe(2);
        vi.stubEnv('TRUST_PROXY', 'true');
        expect(getTrustProxy()).toBe(true);
        vi.stubEnv('TRUST_PROXY', 'loopback, 10.0.0.0/8');
        expect(getTrustProxy()).toBe('loopback, 10.0.0.0/8');
    });
});
