import { describe, expect, it } from 'vitest';
import { isPlaceholderEmail, resolveContactEmail } from './emailPlaceholders.js';

describe('isPlaceholderEmail', () => {
    it.each([
        'filler@godaddy.com',
        'FILLER@GODADDY.COM',
        'contact@seusite.com.br',
        'info@example.com',
        'hello@example.org',
        'admin@yourdomain.com',
        'sales@domain.com',
        'me@email.com',
        'errors@sentry.io',
        'errors@sentry-next.wixpress.com',
        'noreply@wixpress.com',
        'test@anywhere.com',
        'noreply@somebusiness.com',
        'no-reply@somebusiness.com',
        'donotreply@somebusiness.com',
        'contact@yourdomain.com',
        'contact@mysite.net',
        'contact@website.com.br',
        'contact@company.org',
    ])('flags %s as a placeholder', (email) => {
        expect(isPlaceholderEmail(email)).toBe(true);
    });

    it.each([
        'owner@buffalocuts.com',
        'contact@realbarbershop.net',
        'info@moderntestco.com', // "test" inside the domain, not the local part — must not match
        'test.results@realco.com', // local part starts with "test" but isn't exactly "test"
    ])('does not flag a real-looking address %s', (email) => {
        expect(isPlaceholderEmail(email)).toBe(false);
    });
});

describe('resolveContactEmail', () => {
    it('accepts a real single email untouched', () => {
        expect(resolveContactEmail({ email: 'owner@buffalocuts.com' })).toEqual({
            email: 'owner@buffalocuts.com',
        });
    });

    it('rejects a placeholder and records why, without a null email looking unmeasured', () => {
        expect(resolveContactEmail({ email: 'filler@godaddy.com' })).toEqual({
            emailRejected: 'filler@godaddy.com',
            emailRejectedReason: 'placeholder',
        });
    });

    it('falls through to the next candidate in item.emails when the first is a placeholder', () => {
        const result = resolveContactEmail({
            email: 'filler@godaddy.com',
            emails: ['contact@seusite.com.br', 'owner@realbarbershop.com'],
        });
        expect(result).toEqual({ email: 'owner@realbarbershop.com' });
    });

    it('reports the rejection when every candidate is a placeholder', () => {
        const result = resolveContactEmail({
            email: 'filler@godaddy.com',
            emails: ['contact@seusite.com.br'],
        });
        expect(result).toEqual({
            emailRejected: 'filler@godaddy.com',
            emailRejectedReason: 'placeholder',
        });
    });

    it('returns nothing when there is no email at all (not a placeholder rejection)', () => {
        expect(resolveContactEmail({})).toEqual({});
    });

    it('accepts a real email from an emails array when email is absent', () => {
        expect(resolveContactEmail({ emails: ['owner@buffalocuts.com'] })).toEqual({
            email: 'owner@buffalocuts.com',
        });
    });
});
