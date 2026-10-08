import { describe, expect, it } from 'vitest';
import { isValidNiche, optionalNicheSchema, readRunNiche } from './niche.js';

describe('isValidNiche', () => {
    it.each(['barbershop', 'nail_salon', 'hair_salon', 'spa2', 'ab', 'a'.repeat(40)])('accepts %s', (value) => {
        expect(isValidNiche(value)).toBe(true);
    });

    it.each([
        '',
        'a',
        'a'.repeat(41),
        'Barbershop',
        'nail salon',
        'nail-salon',
        '_nail',
        'nail_',
        'nail__salon',
        'barbeariaç',
        'barbershop;drop',
        42,
        null,
        undefined,
    ])('rejects %j', (value) => {
        expect(isValidNiche(value)).toBe(false);
    });
});

describe('optionalNicheSchema', () => {
    it('keeps a valid slug as is', () => {
        expect(optionalNicheSchema.parse('nail_salon')).toBe('nail_salon');
    });

    it('trims surrounding whitespace but never rewrites the slug', () => {
        expect(optionalNicheSchema.parse('  barbershop ')).toBe('barbershop');
        expect(optionalNicheSchema.safeParse('Barbershop').success).toBe(false);
    });

    it('treats missing and null as absent', () => {
        expect(optionalNicheSchema.parse(undefined)).toBeUndefined();
        expect(optionalNicheSchema.parse(null)).toBeUndefined();
    });

    it('rejects a malformed slug with a message that shows the format', () => {
        const result = optionalNicheSchema.safeParse('Nail Salon');
        expect(result.success).toBe(false);
        expect(JSON.stringify(result)).toMatch(/lowercase slug/);
    });
});

describe('readRunNiche', () => {
    it('reads the niche from searchFilters', () => {
        expect(readRunNiche({ niche: 'barbershop', journey_hypothesis: {} })).toBe('barbershop');
    });

    it('is null when absent, malformed, or the run has no filters', () => {
        expect(readRunNiche(null)).toBeNull();
        expect(readRunNiche(undefined)).toBeNull();
        expect(readRunNiche({})).toBeNull();
        expect(readRunNiche({ niche: 'Not A Slug' })).toBeNull();
        expect(readRunNiche({ niche: 5 })).toBeNull();
    });
});
