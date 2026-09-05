import { describe, expect, it } from 'vitest';
import { buildSourceMetadata, summarizeWebPresence } from './xphere.js';
import { classifyWebPresence } from './webPresence.js';

describe('buildSourceMetadata', () => {
    const baseRun = {
        query: 'plumbers',
        location: 'Austin, TX',
        apifyUsageUsd: null as string | null,
        apifyActorId: null as string | null,
        scrapeType: 'standard',
        searchFilters: null as Record<string, unknown> | null,
        enrichedResultsCount: null as number | null,
    };

    describe('enriched_count', () => {
        it('sends the count when the run has one', () => {
            const metadata = buildSourceMetadata({ ...baseRun, enrichedResultsCount: 23 }, 25);
            expect(metadata.enriched_count).toBe(23);
        });

        it('sends an explicit zero, because zero enriched is a real answer', () => {
            // Deliberately unlike cost_usd, where 0 would be a false claim. A `standard` scrape
            // enriches nothing, and Xmail's enriched_count_never_populated alert is meant to keep
            // firing for an `enriched` run that truthfully reports zero.
            const metadata = buildSourceMetadata({ ...baseRun, enrichedResultsCount: 0 }, 25);
            expect(metadata.enriched_count).toBe(0);
        });

        it('omits the key entirely when the column is null — that is the unmeasured case', () => {
            const metadata = buildSourceMetadata({ ...baseRun, enrichedResultsCount: null }, 25);
            expect('enriched_count' in metadata).toBe(false);
        });
    });

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
            // Slug form rather than the opaque short id: an opaque id is
            // high-entropy and trips the gitleaks generic-api-key rule in CI.
            { ...baseRun, apifyActorId: 'compass/crawler-google-places', scrapeType: 'b2b_leads' },
            3,
        );
        expect(metadata.actor_id).toBe('compass/crawler-google-places');
        expect(metadata.template).toBe('b2b_leads');
    });

    it('omits actor_id when the run has no actor recorded', () => {
        const metadata = buildSourceMetadata({ ...baseRun, apifyActorId: null }, 3);
        expect('actor_id' in metadata).toBe(false);
    });

    it('propagates a hypothesis captured before the scrape started', () => {
        const hypothesis = {
            premise: 'Barbershops need better online booking',
            expected: { discovered: '>=20', verified_email_rate: '>=0.3' },
            basis: 'First run in this segment',
        };
        const metadata = buildSourceMetadata({
            ...baseRun,
            searchFilters: { journey_hypothesis: hypothesis },
        }, 7);

        expect(metadata.hypothesis).toEqual(hypothesis);
    });

    it('includes a commercial web-presence summary when supplied', () => {
        const summary = summarizeWebPresence([
            classifyWebPresence('https://example.com'),
            classifyWebPresence('https://booksy.com/example'),
            classifyWebPresence('https://instagram.com/example'),
            classifyWebPresence(null),
        ]);
        const metadata = buildSourceMetadata(baseRun, 4, summary);

        expect(metadata.web_presence).toEqual({
            owned_website_count: 1,
            no_owned_website_count: 3,
            booking_platform_count: 1,
            by_type: {
                owned_website: 1,
                booking_platform: 1,
                social_profile: 1,
                none: 1,
            },
            booking_platforms: { Booksy: 1 },
        });
    });
});
