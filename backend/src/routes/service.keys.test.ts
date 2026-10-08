import { describe, expect, it } from 'vitest';
import { configuredServiceKeys, matchServiceKey } from './service.js';

describe('configuredServiceKeys', () => {
    it('names the original single key hermes', () => {
        expect(configuredServiceKeys({ XCRAPER_SERVICE_KEY: 'h-key' })).toEqual([{ name: 'hermes', key: 'h-key' }]);
    });

    it('adds name=key pairs from XCRAPER_SERVICE_KEYS and skips malformed or short entries', () => {
        const keys = configuredServiceKeys({
            XCRAPER_SERVICE_KEY: 'h-key',
            XCRAPER_SERVICE_KEYS: ' kai = kai-key-aaaaaaaaaaaaaaaa ,=nokey-aaaaaaaaaaaaaaaa,bad,short=abc',
        });
        expect(keys).toEqual([
            { name: 'hermes', key: 'h-key' },
            { name: 'kai', key: 'kai-key-aaaaaaaaaaaaaaaa' },
        ]);
    });

    it('is empty when nothing is configured, so the API fails closed', () => {
        expect(configuredServiceKeys({})).toEqual([]);
    });
});

describe('matchServiceKey', () => {
    const keys = [{ name: 'hermes', key: 'h-key-aaaaaaaaaaaaaaaa' }, { name: 'kai', key: 'kai-key-aaaaaaaaaaaaaaaa' }];

    it('returns the caller name for a matching key', () => {
        expect(matchServiceKey('kai-key-aaaaaaaaaaaaaaaa', keys)).toBe('kai');
        expect(matchServiceKey('h-key-aaaaaaaaaaaaaaaa', keys)).toBe('hermes');
    });

    it('returns null for a wrong or empty key', () => {
        expect(matchServiceKey('kai-key-aaaaaaaaaaaaaaab', keys)).toBeNull();
        expect(matchServiceKey('', keys)).toBeNull();
    });
});
