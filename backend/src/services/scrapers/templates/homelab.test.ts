import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { homelabTemplate, depthForMaxResults, mapHomelabPlace, parseHomelabEmails } from './homelab.js';
import { parseHomelabCsv } from '../../homelab.js';

const here = dirname(fileURLToPath(import.meta.url));
// Normalise line endings: git may check the fixture out with CRLF on Windows.
const csv = readFileSync(join(here, '__fixtures__', 'homelab-sample.csv'), 'utf-8').split(String.fromCharCode(13)).join('');

const EXPECTED_HEADER = 'input_id,link,title,category,address,open_hours,popular_times,website,phone,plus_code,review_count,review_rating,reviews_per_rating,latitude,longitude,cid,status,descriptions,reviews_link,thumbnail,timezone,price_range,data_id,street_view_url,place_id,images,reservations,order_online,menu,owner,complete_address,about,user_reviews,user_reviews_extended,emails';

describe('homelab CSV fixture', () => {
    it('uses the engine header exactly', () => {
        expect(csv.split('\n')[0]).toBe(EXPECTED_HEADER);
    });

    it('parses three rows including quoted commas, quotes and embedded newlines', () => {
        const rows = parseHomelabCsv(csv);
        expect(rows).toHaveLength(3);
        expect(rows[0].address).toBe('12 Main St, Framingham, MA 01702, United States');
        expect(rows[1].about).toBe('line one\nline two');
        expect(rows[2].title).toBe('The "Fade" Room');
        expect(Object.keys(rows[0])).toHaveLength(35);
    });
});

describe('mapHomelabPlace', () => {
    const [full, noEmail, jsonEmails] = parseHomelabCsv(csv).map(mapHomelabPlace);

    it('maps a complete row into the normalized place shape', () => {
        expect(full).toMatchObject({
            contactType: 'place',
            title: 'Barber One',
            category: 'Barber shop',
            address: '12 Main St, Framingham, MA 01702, United States',
            street: '12 Main St',
            city: 'Framingham',
            state: 'MA',
            postalCode: '01702',
            country: 'US',
            phone: '+1 508-555-0101',
            website: 'https://barberone.example',
            rating: 4.8,
            reviewCount: 128,
            latitude: 42.2793,
            longitude: -71.4162,
            googleMapsUrl: 'https://www.google.com/maps/place/Barber+One/data=!4m2',
            placeId: 'ChIJbarberone',
            imageUrl: 'https://lh3.example/thumb1.jpg',
        });
        expect(full.openingHours).toContain('9 AM to 6 PM');
    });

    it('uses the first of two emails as the contact email and keeps both in rawData', () => {
        expect(full.email).toBe('info@barberone.com');
        expect(full.rawData?.emails).toEqual(['info@barberone.com', 'booking@barberone.com']);
        expect(full.rawData?.complete_address).toMatchObject({ city: 'Framingham', postal_code: '01702' });
    });

    it('handles a row with no emails, no website and an empty address', () => {
        expect(noEmail.email).toBeUndefined();
        expect(noEmail.emailRejected).toBeUndefined();
        expect(noEmail.website).toBeUndefined();
        // address composed from complete_address
        expect(noEmail.address).toBe('5 Union Ave, Framingham, MA 01702, US');
        expect(noEmail.city).toBe('Framingham');
        expect(noEmail.rating).toBe(4.1);
        expect(noEmail.reviewCount).toBe(7);
    });

    it('tolerates empty numerics, an empty complete_address and a JSON-array emails column', () => {
        expect(jsonEmails.title).toBe('The "Fade" Room');
        expect(jsonEmails.rating).toBeUndefined();
        expect(jsonEmails.latitude).toBeUndefined();
        expect(jsonEmails.phone).toBeUndefined();
        expect(jsonEmails.city).toBeUndefined();
        expect(jsonEmails.email).toBe('hello@fade.example');
        expect(jsonEmails.rawData?.emails).toEqual(['hello@fade.example', 'owner@fade.example']);
    });

    it('rejects an email that belongs to a booking platform, like the other Maps templates', () => {
        const mapped = mapHomelabPlace({ title: 'Chop Shop', emails: 'help.us@booksy.com' });
        expect(mapped.email).toBeUndefined();
        expect(mapped.emailRejected).toBe('help.us@booksy.com');
        expect(mapped.emailRejectedReason).toBe('platform_domain');
    });

    it('dedupes by place id, falling back to cid', () => {
        expect(homelabTemplate.dedupeKey(full)).toBe('ChIJbarberone');
        expect(homelabTemplate.dedupeKey({ ...jsonEmails, rawData: { cid: '55' } })).toBe('cid:55');
        expect(homelabTemplate.dedupeKey({ contactType: 'place', title: 'x' })).toBeUndefined();
    });
});

describe('parseHomelabEmails', () => {
    it('accepts comma, semicolon, space, JSON array and array inputs', () => {
        expect(parseHomelabEmails('a@x.com, b@y.com')).toEqual(['a@x.com', 'b@y.com']);
        expect(parseHomelabEmails('a@x.com;b@y.com')).toEqual(['a@x.com', 'b@y.com']);
        expect(parseHomelabEmails('a@x.com b@y.com')).toEqual(['a@x.com', 'b@y.com']);
        expect(parseHomelabEmails('["a@x.com","b@y.com"]')).toEqual(['a@x.com', 'b@y.com']);
        expect(parseHomelabEmails(['a@x.com', 'A@X.com'])).toEqual(['a@x.com']);
    });

    it('returns nothing for empty or junk values', () => {
        expect(parseHomelabEmails('')).toEqual([]);
        expect(parseHomelabEmails('[]')).toEqual([]);
        expect(parseHomelabEmails('null')).toEqual([]);
        expect(parseHomelabEmails(undefined)).toEqual([]);
    });
});

describe('homelab job payload', () => {
    afterEach(() => {
        delete process.env.HOMELAB_SCRAPER_DEPTH;
        delete process.env.HOMELAB_SCRAPER_MAX_TIME_SECONDS;
    });

    it('builds the engine job body with defaults', () => {
        const input = homelabTemplate.buildInput(
            { maxResults: 30, language: 'en', countryCode: 'us', query: ' barber shop ', location: ' Framingham, MA ' },
            homelabTemplate.defaults,
        );
        expect(input).toEqual({
            name: 'xcraper: barber shop in Framingham, MA',
            keywords: ['barber shop in Framingham, MA'],
            lang: 'en',
            depth: 4,
            email: true,
            max_time: 1800,
            fast_mode: false,
        });
    });

    it('reads depth and max_time from the environment', () => {
        process.env.HOMELAB_SCRAPER_DEPTH = '3';
        process.env.HOMELAB_SCRAPER_MAX_TIME_SECONDS = '600';
        const input = homelabTemplate.buildInput(
            { maxResults: 100, language: 'en', countryCode: 'us', query: 'a b', location: 'c d' },
            homelabTemplate.defaults,
        );
        expect(input).toMatchObject({ depth: 3, max_time: 600 });
    });

    it('scales depth with the requested result count, capped by HOMELAB_SCRAPER_DEPTH', () => {
        expect(depthForMaxResults(10, 10)).toBe(2);
        expect(depthForMaxResults(30, 10)).toBe(4);
        expect(depthForMaxResults(50, 10)).toBe(6);
        expect(depthForMaxResults(100, 10)).toBe(10);
        expect(depthForMaxResults(500, 10)).toBe(10);
        expect(depthForMaxResults(undefined, 10)).toBe(10);
        expect(depthForMaxResults(100, 3)).toBe(3);
    });

    it('is a zero-credit owner-only homelab template', () => {
        expect(homelabTemplate.provider).toBe('homelab');
        expect(homelabTemplate.ownerOnly).toBe(true);
        expect(homelabTemplate.defaults.creditsPerResult).toBe(0);
    });
});
