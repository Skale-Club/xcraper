import { describe, expect, it } from 'vitest';
import { configuredServiceKeys, matchServiceKey } from './service.js';

describe('configuredServiceKeys', () => {
    it('names the original single key hermes', () => {
        expect(configuredServiceKeys({ XCRAPER_SERVICE_KEY: 'h-key' })).toEqual([{ name: 'hermes', key: 'h-key' }]);
    });

    it('adds name=key pairs from XCRAPER_SERVICE_KEYS and skips malformed or short entries', () => {
        const keys = configuredServiceKeys({
            XCRAPER_SERVICE_KEY: 'h-key',
            XCRAPER_SERVICE_KEYS: ' kai = kai-key-0123456789abcdef ,=nokey-0123456789abcdef,bad,short=abc',
        });
        expect(keys).toEqual([
            { name: 'hermes', key: 'h-key' },
            { name: 'kai', key: 'kai-key-0123456789abcdef' },
        ]);
    });

    it('is empty when nothing is configured, so the API fails closed', () => {
        expect(configuredServiceKeys({})).toEqual([]);
    });
});

describe('matchServiceKey', () => {
    const keys = [{ name: 'hermes', key: 'h-key-0123456789abcdef' }, { name: 'kai', key: 'kai-key-0123456789abcdef' }];

    it('returns the caller name for a matching key', () => {
        expect(matchServiceKey('kai-key-0123456789abcdef', keys)).toBe('kai');
        expect(matchServiceKey('h-key-0123456789abcdef', keys)).toBe('hermes');
    });

    it('returns null for a wrong or empty key', () => {
        expect(matchServiceKey('kai-key-0123456789abcdeX', keys)).toBeNull();
        expect(matchServiceKey('', keys)).toBeNull();
    });
});
