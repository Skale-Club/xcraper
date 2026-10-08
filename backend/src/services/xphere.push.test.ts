import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    run: null as Record<string, unknown> | null,
    contacts: [] as Array<Record<string, unknown>>,
}));

vi.mock('../db/index.js', async () => {
    const schema = await import('../db/schema.js');
    const rowsFor = (table: unknown): unknown[] => {
        if (table === schema.users) return [{ apiKey: 'xph_test_key', apiUrl: null }];
        if (table === schema.searchHistory) return state.run ? [state.run] : [];
        if (table === schema.contacts) return state.contacts;
        return [];
    };
    const select = () => {
        let table: unknown;
        const chain: Record<string, unknown> = {
            from: (t: unknown) => {
                table = t;
                return chain;
            },
            ...Object.fromEntries(['where', 'orderBy', 'limit'].map((m) => [m, () => chain])),
            then: (resolve: (v: unknown) => unknown) => resolve(rowsFor(table)),
        };
        return chain;
    };
    return {
        db: {
            select,
            update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
        },
    };
});
vi.mock('../utils/logger.js', () => ({
    logError: vi.fn(),
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { pushRunToXphere } from './xphere.js';

const fetchMock = vi.fn();

const baseRun = {
    id: 'run-1',
    userId: 'user-1',
    query: 'barber shop',
    location: 'Framingham, MA',
    apifyUsageUsd: null,
    apifyActorId: null,
    scrapeType: 'homelab',
    searchFilters: null as Record<string, unknown> | null,
    enrichedResultsCount: null,
    requestedMaxResults: 30,
};

const contact = (id: string, title: string) => ({
    id,
    searchId: 'run-1',
    title,
    category: 'Barber shop',
    address: '1 Main St',
    phone: '+1 508 555 0100',
    website: null,
    email: null,
    rating: null,
    reviewCount: null,
    latitude: null,
    longitude: null,
    googleMapsUrl: null,
    placeId: `place-${id}`,
    rawData: null,
    facebook: null,
    instagram: null,
    twitter: null,
    linkedin: null,
    youtube: null,
    tiktok: null,
});

function sentBody(): { source: Record<string, unknown>; prospects: Array<Record<string, unknown>> } {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    return JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
}

beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ created: 2, updated: 0, skipped: 0 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    state.run = { ...baseRun };
    state.contacts = [contact('a', 'Cuts One'), contact('b', 'Cuts Two')];
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('pushRunToXphere niche', () => {
    it('puts the run niche in every prospect custom_fields and in the source metadata', async () => {
        state.run = { ...baseRun, searchFilters: { niche: 'barbershop' } };

        const result = await pushRunToXphere('run-1', 'user-1');

        expect(result).toMatchObject({ ok: true, total: 2 });
        const body = sentBody();
        expect(body.prospects).toHaveLength(2);
        for (const prospect of body.prospects) {
            expect((prospect.custom_fields as Record<string, unknown>).niche).toBe('barbershop');
            // The Google Maps category stays exactly as scraped.
            expect((prospect.custom_fields as Record<string, unknown>).category).toBe('Barber shop');
        }
        expect(body.source.metadata).toMatchObject({ niche: 'barbershop' });
    });

    it('sends no niche key at all when the run has none', async () => {
        const result = await pushRunToXphere('run-1', 'user-1');

        expect(result).toMatchObject({ ok: true });
        const body = sentBody();
        for (const prospect of body.prospects) {
            expect('niche' in (prospect.custom_fields as Record<string, unknown>)).toBe(false);
        }
        expect('niche' in (body.source.metadata as Record<string, unknown>)).toBe(false);
    });

    it('sends no niche key when the run only carries a hypothesis', async () => {
        state.run = { ...baseRun, searchFilters: { journey_hypothesis: { premise: 'p' } } };

        await pushRunToXphere('run-1', 'user-1');

        const body = sentBody();
        expect('niche' in (body.prospects[0].custom_fields as Record<string, unknown>)).toBe(false);
        expect(body.source.metadata).toMatchObject({ hypothesis: { premise: 'p' } });
    });
});
