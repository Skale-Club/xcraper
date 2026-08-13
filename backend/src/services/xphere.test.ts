import { describe, expect, it } from 'vitest';
import { buildSourceMetadata } from './xphere.js';

describe('buildSourceMetadata', () => {
    const baseRun = {
        query: 'plumbers',
        location: 'Austin, TX',
        apifyUsageUsd: null as string | null,
        apifyActorId: null as string | null,
        scrapeType: 'standard',
    };

    it('converts a normal decimal string usage figure into a number', () => {
        const metadata = buildSourceMetadata({ ...baseRun, apifyUsageUsd: '1.2345' }, 10);
        expect(metadata.cost_usd).toBe(1.2345);
        expect(typeof metadata.cost_usd).toBe('number');
    });

    it('keeps cost_usd as null when the column is null (never zero)', () => {
        const metadata = buildSourceMetadata({ ...baseRun, apifyUsageUsd: null }, 10);
        expect(metadata.cost_usd).toBeNull();
    });

    it('keeps cost_usd as null for a non-numeric/garbage value rather than NaN', () => {
        const metadata = buildSourceMetadata({ ...baseRun, apifyUsageUsd: 'not-a-number' }, 10);
        expect(metadata.cost_usd).toBeNull();
    });

    it('includes query, location and result_count', () => {
        const metadata = buildSourceMetadata(baseRun, 7);
        expect(metadata.query).toBe('plumbers');
        expect(metadata.location).toBe('Austin, TX');
        expect(metadata.result_count).toBe(7);
    });

    it('includes actor_id and template when present on the run', () => {
        const metadata = buildSourceMetadata(
            { ...baseRun, apifyActorId: 'nwua9Gu5YrADL7ZDj', scrapeType: 'b2b_leads' },
            3,
        );
        expect(metadata.actor_id).toBe('nwua9Gu5YrADL7ZDj');
        expect(metadata.template).toBe('b2b_leads');
    });

    it('omits actor_id when the run has no actor recorded', () => {
        const metadata = buildSourceMetadata({ ...baseRun, apifyActorId: null }, 3);
        expect('actor_id' in metadata).toBe(false);
    });
});
