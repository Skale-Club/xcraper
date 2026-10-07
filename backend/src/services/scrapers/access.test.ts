import { afterEach, describe, expect, it } from 'vitest';
import { canUseScraper, getSuperAdminEmail, isSuperAdminEmail } from './access.js';
import { homelabTemplate } from './templates/homelab.js';
import { standardTemplate } from './templates/standard.js';

describe('owner-only scraper gate', () => {
    afterEach(() => {
        delete process.env.SUPER_ADMIN_EMAIL;
    });

    it('defaults to skale.club@gmail.com and ignores case and whitespace', () => {
        expect(getSuperAdminEmail()).toBe('skale.club@gmail.com');
        expect(isSuperAdminEmail('skale.club@gmail.com')).toBe(true);
        expect(isSuperAdminEmail('  Skale.Club@Gmail.com ')).toBe(true);
    });

    it('rejects other emails and missing values', () => {
        expect(isSuperAdminEmail('other.admin@example.com')).toBe(false);
        expect(isSuperAdminEmail('')).toBe(false);
        expect(isSuperAdminEmail(undefined)).toBe(false);
        expect(isSuperAdminEmail(null)).toBe(false);
    });

    it('honours SUPER_ADMIN_EMAIL, trimmed and case-insensitive', () => {
        process.env.SUPER_ADMIN_EMAIL = '  Boss@Example.COM ';
        expect(isSuperAdminEmail('boss@example.com')).toBe(true);
        expect(isSuperAdminEmail('skale.club@gmail.com')).toBe(false);
    });

    it('falls back to the default when SUPER_ADMIN_EMAIL is blank', () => {
        process.env.SUPER_ADMIN_EMAIL = '   ';
        expect(isSuperAdminEmail('skale.club@gmail.com')).toBe(true);
    });

    it('restricts the homelab template to the super admin and leaves others open', () => {
        expect(homelabTemplate.ownerOnly).toBe(true);
        expect(canUseScraper(homelabTemplate, 'skale.club@gmail.com')).toBe(true);
        expect(canUseScraper(homelabTemplate, 'other.admin@example.com')).toBe(false);
        expect(canUseScraper(standardTemplate, 'anyone@example.com')).toBe(true);
    });
});
