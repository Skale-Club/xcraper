import { describe, expect, it } from 'vitest';
import { classifyWebPresence } from './webPresence.js';

describe('classifyWebPresence', () => {
    it.each([
        ['https://my.booksy.com/en-us/123', 'Booksy'],
        ['https://book.thecut.co/example', 'TheCut'],
        ['https://example.glossgenius.com', 'GlossGenius'],
        ['https://example.square.site', 'Square Appointments'],
    ])('recognizes booking platform %s', (url, provider) => {
        expect(classifyWebPresence(url)).toMatchObject({
            type: 'booking_platform',
            bookingPlatform: provider,
            ownedDomain: null,
        });
    });

    it('does not treat Google Maps as an owned website', () => {
        expect(classifyWebPresence('https://www.google.com/maps/place/example')).toMatchObject({
            type: 'directory_listing',
            platform: 'Google Maps',
            ownedWebsiteUrl: null,
        });
    });

    it('unwraps a Google redirect before classifying the destination', () => {
        expect(classifyWebPresence('https://www.google.com/url?q=https%3A%2F%2Fbarber.example%2Fbook')).toMatchObject({
            type: 'owned_website',
            ownedDomain: 'barber.example',
        });
    });

    it('uses a social profile only when no primary URL exists', () => {
        expect(classifyWebPresence(null, ['https://instagram.com/example'])).toMatchObject({
            type: 'social_profile',
            platform: 'Instagram',
        });
    });

    it('keeps an independent domain as an owned website', () => {
        expect(classifyWebPresence('shop.example.com/book')).toMatchObject({
            type: 'owned_website',
            ownedDomain: 'shop.example.com',
            bookingPlatform: null,
        });
    });

    it('reports none when no usable URL exists', () => {
        expect(classifyWebPresence(undefined)).toMatchObject({ type: 'none', sourceUrl: null, reason: null });
    });

    // Real Boston/Worcester domains from the 2026-09 run that motivated Fase 33 — six
    // "owned websites" that weren't, plus the barbershops.net directory that slipped
    // through as one in both cities.
    describe('Boston/Worcester false-positive fixtures (Fase 33)', () => {
        it.each([
            'https://zincx.top',
            'https://unkusa.top',
            'https://moneyus.top',
        ])('classifies parked low-reputation-TLD domain %s as none, not owned_website', (url) => {
            expect(classifyWebPresence(url)).toMatchObject({
                type: 'none',
                reason: 'junk_tld',
                ownedWebsiteUrl: null,
                ownedDomain: null,
            });
        });

        it('recognizes a booksy.net subdomain as the Booksy booking platform', () => {
            expect(classifyWebPresence('https://chichi-barbershop.booksy.net')).toMatchObject({
                type: 'booking_platform',
                bookingPlatform: 'Booksy',
                ownedDomain: null,
            });
        });

        it('classifies barbershops.net as a directory listing, not an owned website', () => {
            expect(classifyWebPresence('https://barbershops.net/salon/example')).toMatchObject({
                type: 'directory_listing',
                platform: 'Barbershops.net',
                ownedWebsiteUrl: null,
                reason: null,
            });
        });
    });
});
