import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { contacts, searchHistory } from '../db/schema.js';
import { eq, and, desc, or, like, sql, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Escape LIKE wildcards so a user searching for "%" or "_" matches those literal
// characters instead of "anything" (Postgres treats backslash as the escape char).
function escapeLikePattern(input: string): string {
    return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Build a CSV cell: quote/escape per RFC 4180 and neutralize spreadsheet formula
// injection (values starting with = + - @ tab/CR are treated as formulas by Excel
// and Google Sheets; scraped business data is attacker-influenceable).
function csvCell(value: unknown): string {
    let str = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
}

// Get all contacts for the current user
router.get('/', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const userId = req.user.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const search = req.query.search as string;
        const favorite = req.query.favorite === 'true';
        const offset = (page - 1) * limit;

        let query = db.select()
            .from(contacts)
            .where(eq(contacts.userId, userId));

        // Apply filters
        if (search) {
            query = db.select()
                .from(contacts)
                .where(and(
                    eq(contacts.userId, userId),
                    or(
                        like(contacts.title, `%${escapeLikePattern(search)}%`),
                        like(contacts.address, `%${escapeLikePattern(search)}%`),
                        like(contacts.phone, `%${escapeLikePattern(search)}%`),
                        like(contacts.email, `%${escapeLikePattern(search)}%`),
                        like(contacts.category, `%${escapeLikePattern(search)}%`)
                    )
                ));
        }

        if (favorite) {
            query = db.select()
                .from(contacts)
                .where(and(
                    eq(contacts.userId, userId),
                    eq(contacts.isFavorite, true)
                ));
        }

        const userContacts = await query
            .orderBy(desc(contacts.createdAt))
            .limit(limit)
            .offset(offset);

        // Get total count for pagination
        const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(contacts)
            .where(eq(contacts.userId, userId));

        const total = Number(countResult[0]?.count || 0);

        res.json({
            contacts: userContacts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get contacts by search ID
router.get('/search/:searchId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { searchId } = req.params as Record<string, string>;

        // Verify the search belongs to the user
        const [searchRecord] = await db.select()
            .from(searchHistory)
            .where(and(
                eq(searchHistory.id, searchId),
                eq(searchHistory.userId, req.user.id)
            ))
            .limit(1);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        const searchContacts = await db.select()
            .from(contacts)
            .where(eq(contacts.searchId, searchId))
            .orderBy(desc(contacts.createdAt));

        res.json({ contacts: searchContacts });
    } catch (error) {
        console.error('Get search contacts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single contact
router.get('/:contactId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { contactId } = req.params as Record<string, string>;

        const [contact] = await db.select()
            .from(contacts)
            .where(and(
                eq(contacts.id, contactId),
                eq(contacts.userId, req.user.id)
            ))
            .limit(1);

        if (!contact) {
            res.status(404).json({ error: 'Contact not found' });
            return;
        }

        res.json({ contact });
    } catch (error) {
        console.error('Get contact error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle favorite status
router.patch('/:contactId/favorite', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { contactId } = req.params as Record<string, string>;

        const [existingContact] = await db.select()
            .from(contacts)
            .where(and(
                eq(contacts.id, contactId),
                eq(contacts.userId, req.user.id)
            ))
            .limit(1);

        if (!existingContact) {
            res.status(404).json({ error: 'Contact not found' });
            return;
        }

        const [updatedContact] = await db.update(contacts)
            .set({ isFavorite: !existingContact.isFavorite })
            .where(eq(contacts.id, contactId))
            .returning();

        res.json({
            message: `Contact ${updatedContact.isFavorite ? 'added to' : 'removed from'} favorites`,
            contact: updatedContact,
        });
    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle archive status
router.patch('/:contactId/archive', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { contactId } = req.params as Record<string, string>;

        const [existingContact] = await db.select()
            .from(contacts)
            .where(and(
                eq(contacts.id, contactId),
                eq(contacts.userId, req.user.id)
            ))
            .limit(1);

        if (!existingContact) {
            res.status(404).json({ error: 'Contact not found' });
            return;
        }

        const [updatedContact] = await db.update(contacts)
            .set({ isArchived: !existingContact.isArchived })
            .where(eq(contacts.id, contactId))
            .returning();

        res.json({
            message: `Contact ${updatedContact.isArchived ? 'archived' : 'unarchived'}`,
            contact: updatedContact,
        });
    } catch (error) {
        console.error('Toggle archive error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete contact
router.delete('/:contactId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { contactId } = req.params as Record<string, string>;

        const [existingContact] = await db.select()
            .from(contacts)
            .where(and(
                eq(contacts.id, contactId),
                eq(contacts.userId, req.user.id)
            ))
            .limit(1);

        if (!existingContact) {
            res.status(404).json({ error: 'Contact not found' });
            return;
        }

        await db.delete(contacts)
            .where(eq(contacts.id, contactId));

        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Bulk delete contacts
router.post('/bulk-delete', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { contactIds } = req.body;

        if (!Array.isArray(contactIds) || contactIds.length === 0) {
            res.status(400).json({ error: 'contactIds must be a non-empty array' });
            return;
        }

        const ids = contactIds.filter((id): id is string => typeof id === 'string');

        if (ids.length === 0) {
            res.status(400).json({ error: 'contactIds must contain valid ids' });
            return;
        }

        // Delete only the caller's contacts in a single atomic statement, and report
        // the actual number removed (ids not owned by the user simply won't match).
        const deleted = await db.delete(contacts)
            .where(and(
                eq(contacts.userId, req.user.id),
                inArray(contacts.id, ids)
            ))
            .returning({ id: contacts.id });

        res.json({
            message: `${deleted.length} contact(s) deleted successfully`,
            deleted: deleted.length,
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export contacts as JSON
router.get('/export/json', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const userContacts = await db.select()
            .from(contacts)
            .where(eq(contacts.userId, req.user.id))
            .orderBy(desc(contacts.createdAt));

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=contacts.json');
        res.json(userContacts);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export contacts from specific search as CSV
router.get('/export/csv/search/:searchId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { searchId } = req.params as Record<string, string>;

        // Verify search belongs to user
        const [search] = await db.select()
            .from(searchHistory)
            .where(and(
                eq(searchHistory.id, searchId),
                eq(searchHistory.userId, req.user.id)
            ))
            .limit(1);

        if (!search) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        // Only allow export if search is completed
        if (search.status !== 'completed') {
            res.status(400).json({
                error: 'Search not completed yet',
                status: search.status,
                message: 'You can only export results after the search completes'
            });
            return;
        }

        const searchContacts = await db.select()
            .from(contacts)
            .where(eq(contacts.searchId, searchId))
            .orderBy(desc(contacts.createdAt));

        // Generate CSV
        const headers = [
            'Title', 'Category', 'Address', 'Phone', 'Website', 'Email',
            'Rating', 'Review Count', 'Latitude', 'Longitude', 'Google Maps URL'
        ];

        const csvRows = [headers.join(',')];

        for (const contact of searchContacts) {
            const row = [
                csvCell(contact.title),
                csvCell(contact.category),
                csvCell(contact.address),
                csvCell(contact.phone),
                csvCell(contact.website),
                csvCell(contact.email),
                csvCell(contact.rating),
                csvCell(contact.reviewCount),
                csvCell(contact.latitude),
                csvCell(contact.longitude),
                csvCell(contact.googleMapsUrl),
            ];
            csvRows.push(row.join(','));
        }

        const csv = csvRows.join('\n');

        const filename = `search_${search.query}_${search.location}.csv`
            .replace(/[^a-z0-9_\-.]/gi, '_')
            .toLowerCase();

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(csv);
    } catch (error) {
        console.error('Export search CSV error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export all contacts as CSV
router.get('/export/csv', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const userContacts = await db.select()
            .from(contacts)
            .where(eq(contacts.userId, req.user.id))
            .orderBy(desc(contacts.createdAt));

        // Generate CSV
        const headers = [
            'Title', 'Category', 'Address', 'Phone', 'Website', 'Email',
            'Rating', 'Review Count', 'Latitude', 'Longitude', 'Google Maps URL'
        ];

        const csvRows = [headers.join(',')];

        for (const contact of userContacts) {
            const row = [
                csvCell(contact.title),
                csvCell(contact.category),
                csvCell(contact.address),
                csvCell(contact.phone),
                csvCell(contact.website),
                csvCell(contact.email),
                csvCell(contact.rating),
                csvCell(contact.reviewCount),
                csvCell(contact.latitude),
                csvCell(contact.longitude),
                csvCell(contact.googleMapsUrl),
            ];
            csvRows.push(row.join(','));
        }

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
        res.send(csv);
    } catch (error) {
        console.error('Export CSV error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
