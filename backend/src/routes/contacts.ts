import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { contacts, searchHistory } from '../db/schema.js';
import { eq, and, desc, or, like, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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
                        like(contacts.title, `%${search}%`),
                        like(contacts.address, `%${search}%`),
                        like(contacts.phone, `%${search}%`),
                        like(contacts.email, `%${search}%`),
                        like(contacts.category, `%${search}%`)
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

        const { searchId } = req.params;

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

        const { contactId } = req.params;

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

        const { contactId } = req.params;

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

// Delete contact
router.delete('/:contactId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { contactId } = req.params;

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

        // Delete only contacts belonging to the user
        for (const contactId of contactIds) {
            await db.delete(contacts)
                .where(and(
                    eq(contacts.id, contactId),
                    eq(contacts.userId, req.user.id)
                ));
        }

        res.json({
            message: `${contactIds.length} contact(s) deleted successfully`
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

        const { searchId } = req.params;

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
                `"${(contact.title || '').replace(/"/g, '""')}"`,
                `"${(contact.category || '').replace(/"/g, '""')}"`,
                `"${(contact.address || '').replace(/"/g, '""')}"`,
                `"${(contact.phone || '').replace(/"/g, '""')}"`,
                `"${(contact.website || '').replace(/"/g, '""')}"`,
                `"${(contact.email || '').replace(/"/g, '""')}"`,
                contact.rating || '',
                contact.reviewCount || '',
                contact.latitude || '',
                contact.longitude || '',
                `"${(contact.googleMapsUrl || '').replace(/"/g, '""')}"`,
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
                `"${(contact.title || '').replace(/"/g, '""')}"`,
                `"${(contact.category || '').replace(/"/g, '""')}"`,
                `"${(contact.address || '').replace(/"/g, '""')}"`,
                `"${(contact.phone || '').replace(/"/g, '""')}"`,
                `"${(contact.website || '').replace(/"/g, '""')}"`,
                `"${(contact.email || '').replace(/"/g, '""')}"`,
                contact.rating || '',
                contact.reviewCount || '',
                contact.latitude || '',
                contact.longitude || '',
                `"${(contact.googleMapsUrl || '').replace(/"/g, '""')}"`,
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
