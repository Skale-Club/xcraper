import { Router, Response } from 'express';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import { db } from '../db/index.js';
import { users, searchHistory, contacts, creditTransactions } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import {
    startScrapingTask,
    getTaskStatus,
    getTaskResults,
    isApifyConfigured
} from '../services/apify.js';

dotenv.config();

const router = Router();

// Credits configuration
const CREDITS_PER_SEARCH = parseInt(process.env.CREDITS_PER_SEARCH || '1');
const CREDITS_PER_CONTACT = parseInt(process.env.CREDITS_PER_CONTACT || '1');

// Validation schemas
const startSearchSchema = z.object({
    query: z.string().min(2, 'Search query must be at least 2 characters'),
    location: z.string().min(2, 'Location must be at least 2 characters'),
    maxResults: z.number().int().min(1).max(500).optional().default(50),
});

// Start a new search
router.post('/', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const userId = req.user.id;

        const validationResult = startSearchSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten()
            });
            return;
        }

        const { query, location, maxResults } = validationResult.data;

        // Check if Apify is configured
        if (!isApifyConfigured()) {
            res.status(503).json({
                error: 'Scraping service is not configured. Please contact administrator.'
            });
            return;
        }

        // Check user credits
        const [user] = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Calculate required credits (search + estimated contacts)
        const estimatedCredits = CREDITS_PER_SEARCH + (maxResults * CREDITS_PER_CONTACT);

        if (user.credits < CREDITS_PER_SEARCH) {
            res.status(402).json({
                error: 'Insufficient credits',
                required: CREDITS_PER_SEARCH,
                available: user.credits,
            });
            return;
        }

        // Deduct initial search credit
        await db.update(users)
            .set({
                credits: user.credits - CREDITS_PER_SEARCH,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId));

        // Create search history entry
        const [searchRecord] = await db.insert(searchHistory).values({
            userId,
            query,
            location,
            status: 'pending',
            creditsUsed: CREDITS_PER_SEARCH,
        }).returning();

        // Log credit transaction
        await db.insert(creditTransactions).values({
            userId,
            amount: -CREDITS_PER_SEARCH,
            type: 'usage',
            description: `Search: "${query}" in ${location}`,
            searchId: searchRecord.id,
        });

        // Start Apify task
        let apifyRunId: string;
        try {
            apifyRunId = await startScrapingTask({
                search: query,
                location,
                maxResults,
            });

            // Update search record with Apify run ID
            await db.update(searchHistory)
                .set({
                    apifyRunId,
                    status: 'running'
                })
                .where(eq(searchHistory.id, searchRecord.id));

        } catch (apifyError) {
            // Refund credits if Apify fails
            await db.update(users)
                .set({
                    credits: user.credits,
                    updatedAt: new Date()
                })
                .where(eq(users.id, userId));

            await db.update(searchHistory)
                .set({ status: 'failed' })
                .where(eq(searchHistory.id, searchRecord.id));

            throw apifyError;
        }

        res.status(202).json({
            message: 'Search started successfully',
            searchId: searchRecord.id,
            apifyRunId,
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Failed to start search',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Get search status
router.get('/:searchId/status', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const userId = req.user.id;
        const { searchId } = req.params;

        // Get search record
        const [searchRecord] = await db.select()
            .from(searchHistory)
            .where(and(
                eq(searchHistory.id, searchId),
                eq(searchHistory.userId, userId)
            ))
            .limit(1);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        // If still running, check Apify status
        if (searchRecord.status === 'running' && searchRecord.apifyRunId) {
            try {
                const apifyStatus = await getTaskStatus(searchRecord.apifyRunId);

                if (apifyStatus.status === 'SUCCEEDED') {
                    // Fetch and store results
                    const results = await getTaskResults(searchRecord.apifyRunId);

                    // Get user for credit check
                    const [user] = await db.select()
                        .from(users)
                        .where(eq(users.id, userId))
                        .limit(1);

                    if (!user) {
                        res.status(404).json({ error: 'User not found' });
                        return;
                    }

                    // Calculate credits for contacts
                    const contactCredits = results.length * CREDITS_PER_CONTACT;
                    const totalCreditsNeeded = contactCredits;

                    // Deduct contact credits (or as many as user can afford)
                    const creditsToDeduct = Math.min(totalCreditsNeeded, user.credits);
                    const contactsToSave = Math.floor(creditsToDeduct / CREDITS_PER_CONTACT);

                    if (contactsToSave > 0) {
                        // Update user credits
                        await db.update(users)
                            .set({
                                credits: user.credits - (contactsToSave * CREDITS_PER_CONTACT),
                                updatedAt: new Date()
                            })
                            .where(eq(users.id, userId));

                        // Log credit transaction
                        await db.insert(creditTransactions).values({
                            userId,
                            amount: -(contactsToSave * CREDITS_PER_CONTACT),
                            type: 'usage',
                            description: `Contacts from search: "${searchRecord.query}"`,
                            searchId: searchRecord.id,
                        });
                    }

                    // Save contacts
                    if (results.length > 0) {
                        const contactsToInsert = results.slice(0, contactsToSave).map(place => ({
                            searchId: searchRecord.id,
                            userId,
                            title: place.title,
                            category: place.category,
                            address: place.address,
                            phone: place.phone,
                            website: place.website,
                            email: place.email,
                            rating: place.rating?.toString(),
                            reviewCount: place.reviewCount,
                            latitude: place.latitude?.toString(),
                            longitude: place.longitude?.toString(),
                            openingHours: place.openingHours,
                            imageUrl: place.imageUrl,
                            googleMapsUrl: place.googleMapsUrl,
                            rawData: place.rawData,
                        }));

                        await db.insert(contacts).values(contactsToInsert);
                    }

                    // Update search record
                    await db.update(searchHistory)
                        .set({
                            status: 'completed',
                            totalResults: results.length,
                            creditsUsed: searchRecord.creditsUsed + (contactsToSave * CREDITS_PER_CONTACT),
                            completedAt: new Date(),
                        })
                        .where(eq(searchHistory.id, searchRecord.id));

                    res.json({
                        status: 'completed',
                        totalResults: results.length,
                        savedResults: contactsToSave,
                        creditsUsed: searchRecord.creditsUsed + (contactsToSave * CREDITS_PER_CONTACT),
                    });
                    return;
                } else if (apifyStatus.status === 'FAILED' || apifyStatus.status === 'ABORTED') {
                    await db.update(searchHistory)
                        .set({ status: 'failed' })
                        .where(eq(searchHistory.id, searchRecord.id));

                    res.json({
                        status: 'failed',
                        message: 'Scraping task failed',
                    });
                    return;
                }

                res.json({
                    status: 'running',
                    progress: apifyStatus.progress,
                    itemsCount: apifyStatus.itemsCount,
                });
                return;
            } catch (apifyError) {
                console.error('Error checking Apify status:', apifyError);
                // Continue to return current status from DB
            }
        }

        res.json({
            status: searchRecord.status,
            totalResults: searchRecord.totalResults,
            creditsUsed: searchRecord.creditsUsed,
            completedAt: searchRecord.completedAt,
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get search history
router.get('/history', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const history = await db.select()
            .from(searchHistory)
            .where(eq(searchHistory.userId, req.user.id))
            .orderBy(desc(searchHistory.createdAt))
            .limit(limit)
            .offset(offset);

        res.json({ history });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get search details with contacts
router.get('/:searchId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { searchId } = req.params;

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
            .where(eq(contacts.searchId, searchId));

        res.json({
            search: searchRecord,
            contacts: searchContacts,
        });
    } catch (error) {
        console.error('Get search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete search and its contacts
router.delete('/:searchId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { searchId } = req.params;

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

        // Delete contacts first (cascade should handle this, but being explicit)
        await db.delete(contacts)
            .where(eq(contacts.searchId, searchId));

        // Delete search record
        await db.delete(searchHistory)
            .where(eq(searchHistory.id, searchId));

        res.json({ message: 'Search deleted successfully' });
    } catch (error) {
        console.error('Delete search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
