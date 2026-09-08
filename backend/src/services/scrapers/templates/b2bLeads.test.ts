import { describe, expect, it } from 'vitest';
import { mapLead } from './b2bLeads.js';

describe('mapLead email placeholder filtering', () => {
    it('keeps a real primary email untouched', () => {
        const mapped = mapLead({
            full_name: 'Jane Doe',
            email: 'jane@realcompany.com',
        });

        expect(mapped.email).toBe('jane@realcompany.com');
        expect(mapped.emailRejected).toBeUndefined();
        expect(mapped.emailRejectedReason).toBeUndefined();
    });

    it('rejects a placeholder primary email even though the actor labels it validated by default', () => {
        // Simulates a user loosening `emailStatus` (EMAIL_STATUS_OPTIONS) so the actor returns
        // an unverified/guessed address that happens to be template filler.
        const mapped = mapLead({
            full_name: 'Jane Doe',
            email: 'filler@godaddy.com',
        });

        expect(mapped.email).toBeUndefined();
        expect(mapped.emailRejected).toBe('filler@godaddy.com');
        expect(mapped.emailRejectedReason).toBe('placeholder');
    });

    it('keeps a real personalEmail untouched', () => {
        const mapped = mapLead({
            full_name: 'Jane Doe',
            personal_email: 'jane.doe@gmail.com',
        });

        expect(mapped.personalEmail).toBe('jane.doe@gmail.com');
    });

    it('drops a placeholder personalEmail without recording a rejection', () => {
        const mapped = mapLead({
            full_name: 'Jane Doe',
            email: 'jane@realcompany.com',
            personal_email: 'noreply@somesite.com',
        });

        // Dropped: the lead's contact channel (`email`) is untouched, so this is not a
        // "business lost its email" event and must not surface via emailRejected/
        // emailRejectedReason (those feed the emails_lost_to_placeholder run metric — see
        // services/xphere.ts and the comment in mapLead).
        expect(mapped.personalEmail).toBeUndefined();
        expect(mapped.email).toBe('jane@realcompany.com');
        expect(mapped.emailRejected).toBeUndefined();
        expect(mapped.emailRejectedReason).toBeUndefined();
    });

    it('rejects both a placeholder email and a placeholder personalEmail independently', () => {
        const mapped = mapLead({
            full_name: 'Jane Doe',
            email: 'filler@godaddy.com',
            personal_email: 'test@anywhere.com',
        });

        expect(mapped.email).toBeUndefined();
        expect(mapped.emailRejected).toBe('filler@godaddy.com');
        expect(mapped.emailRejectedReason).toBe('placeholder');
        expect(mapped.personalEmail).toBeUndefined();
    });
});
