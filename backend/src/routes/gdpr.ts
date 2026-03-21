import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { users, contacts, searchHistory, creditTransactions, subscriptionPlans } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { logInfo, logError } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/user/export-data
 * Export all user data as JSON (GDPR Article 20 - Right to data portability)
 */
router.get('/export-data', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        logInfo('Data export requested', { userId });

        // Fetch all user data in parallel
        const [
            userData,
            userContacts,
            userSearches,
            userTransactions
        ] = await Promise.all([
            // User profile
            db.select()
                .from(users)
                .where(eq(users.id, userId))
                .limit(1),

            // Contacts
            db.select()
                .from(contacts)
                .where(eq(contacts.userId, userId)),

            // Search history
            db.select()
                .from(searchHistory)
                .where(eq(searchHistory.userId, userId)),

            // Credit transactions
            db.select()
                .from(creditTransactions)
                .where(eq(creditTransactions.userId, userId))
        ]);

        if (!userData[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove sensitive fields
        const safeUserData = {
            id: userData[0].id,
            email: userData[0].email,
            name: userData[0].name,
            role: userData[0].role,
            credits: userData[0].credits,
            company: userData[0].company,
            phone: userData[0].phone,
            createdAt: userData[0].createdAt,
            updatedAt: userData[0].updatedAt
        };

        // Compile export data
        const exportData = {
            exportDate: new Date().toISOString(),
            user: safeUserData,
            contacts: userContacts.map(c => ({
                id: c.id,
                title: c.title,
                category: c.category,
                address: c.address,
                phone: c.phone,
                website: c.website,
                email: c.email,
                rating: c.rating,
                reviewCount: c.reviewCount,
                isFavorite: c.isFavorite,
                createdAt: c.createdAt
            })),
            searches: userSearches.map(s => ({
                id: s.id,
                query: s.query,
                location: s.location,
                status: s.status,
                totalResults: s.totalResults,
                creditsUsed: s.creditsUsed,
                createdAt: s.createdAt,
                completedAt: s.completedAt
            })),
            transactions: userTransactions.map(t => ({
                id: t.id,
                amount: t.amount,
                type: t.type,
                description: t.description,
                createdAt: t.createdAt
            }))
        };

        logInfo('Data export completed', {
            userId,
            contactsCount: userContacts.length,
            searchesCount: userSearches.length,
            transactionsCount: userTransactions.length
        });

        // Set headers for download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="xcraper-data-export-${new Date().toISOString().split('T')[0]}.json"`);

        return res.json(exportData);

    } catch (error) {
        logError('Data export failed', error, { userId: req.user?.id });
        return res.status(500).json({ error: 'Failed to export data' });
    }
});

/**
 * POST /api/user/delete-account
 * Request account deletion (GDPR Article 17 - Right to erasure)
 * This soft-deletes the account and schedules permanent deletion after 30 days
 */
router.post('/delete-account', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { confirmation } = req.body;

        // Require confirmation text
        if (confirmation !== 'DELETE MY ACCOUNT') {
            return res.status(400).json({
                error: 'Please type "DELETE MY ACCOUNT" to confirm deletion'
            });
        }

        logInfo('Account deletion requested', { userId });

        // Check for active subscription
        const [user] = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (user?.stripeSubscriptionId) {
            return res.status(400).json({
                error: 'Please cancel your active subscription before deleting your account',
                hasActiveSubscription: true
            });
        }

        // Delete all user data in a transaction
        await db.transaction(async (tx) => {
            // Delete contacts
            await tx.delete(contacts)
                .where(eq(contacts.userId, userId));

            // Delete search history
            await tx.delete(searchHistory)
                .where(eq(searchHistory.userId, userId));

            // Delete credit transactions
            await tx.delete(creditTransactions)
                .where(eq(creditTransactions.userId, userId));

            // Finally, delete the user
            await tx.delete(users)
                .where(eq(users.id, userId));
        });

        logInfo('Account deletion completed', { userId, email: user?.email });

        return res.json({
            success: true,
            message: 'Your account and all associated data have been permanently deleted.'
        });

    } catch (error) {
        logError('Account deletion failed', error, { userId: req.user?.id });
        return res.status(500).json({ error: 'Failed to delete account' });
    }
});

/**
 * GET /api/user/data-summary
 * Get a summary of user's data (for transparency)
 */
router.get('/data-summary', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const [
            contactsCount,
            searchesCount,
            transactionsCount
        ] = await Promise.all([
            db.select({ count: contacts.id })
                .from(contacts)
                .where(eq(contacts.userId, userId)),

            db.select({ count: searchHistory.id })
                .from(searchHistory)
                .where(eq(searchHistory.userId, userId)),

            db.select({ count: creditTransactions.id })
                .from(creditTransactions)
                .where(eq(creditTransactions.userId, userId))
        ]);

        return res.json({
            contactsCount: contactsCount.length,
            searchesCount: searchesCount.length,
            transactionsCount: transactionsCount.length
        });

    } catch (error) {
        logError('Data summary failed', error, { userId: req.user?.id });
        return res.status(500).json({ error: 'Failed to get data summary' });
    }
});

export default router;
