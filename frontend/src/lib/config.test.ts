import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUrl, getApiBaseUrl, getAppHost, getAppOrigin } from './config';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('getApiBaseUrl', () => {
    it('is empty when the API shares the SPA origin', () => {
        vi.stubEnv('VITE_API_URL', '');
        expect(getApiBaseUrl()).toBe('');
    });

    it('trims whitespace and trailing slashes', () => {
        vi.stubEnv('VITE_API_URL', ' https://api.example.test/ ');
        expect(getApiBaseUrl()).toBe('https://api.example.test');
    });
});

describe('app origin', () => {
    it('defaults to the origin the page was loaded from', () => {
        vi.stubEnv('VITE_APP_URL', '');
        expect(getAppOrigin()).toBe(window.location.origin);
        expect(getAppHost()).toBe(window.location.host);
        expect(appUrl('/auth/callback')).toBe(`${window.location.origin}/auth/callback`);
    });

    it('can be pinned with VITE_APP_URL', () => {
        vi.stubEnv('VITE_APP_URL', 'https://app.example.test/');
        expect(getAppOrigin()).toBe('https://app.example.test');
        expect(getAppHost()).toBe('app.example.test');
        expect(appUrl('auth/reset-password')).toBe('https://app.example.test/auth/reset-password');
    });
});
