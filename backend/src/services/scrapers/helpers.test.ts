import { describe, expect, it } from 'vitest';
import { mapGooglePlace } from './helpers.js';

describe('mapGooglePlace web identity', () => {
    it('keeps the Google Maps listing separate when the business has no website', () => {
        const mapped = mapGooglePlace({
            title: 'Buffalo Cuts',
            url: 'https://www.google.com/maps/place/Buffalo+Cuts',
        });

        expect(mapped.website).toBeUndefined();
        expect(mapped.googleMapsUrl).toBe('https://www.google.com/maps/place/Buffalo+Cuts');
    });

    it('uses the explicit business website and still preserves the Maps listing', () => {
        const mapped = mapGooglePlace({
            title: 'Buffalo Cuts',
            website: 'https://buffalocuts.example',
            url: 'https://www.google.com/maps/place/Buffalo+Cuts',
        });

        expect(mapped.website).toBe('https://buffalocuts.example');
        expect(mapped.googleMapsUrl).toBe('https://www.google.com/maps/place/Buffalo+Cuts');
    });
});
