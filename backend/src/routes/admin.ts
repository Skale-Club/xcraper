import 'dotenv/config';
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, contacts, searchHistory, creditTransactions, creditPackages } from '../db/schema';
import { eq, desc, sql, count, sum } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// Schema for updating user
const updateUserSchema = z.object({
    name: z.string().optional(),
    credits: z.number().int().optional(),
    role: z.enum(['user', 'admin']).optional(),
    isActive: z.boolean().optional(),
});

// Schema for adding credits
const addCreditsSchema = z.object({
    amount: z.number().int().positive(),
    description: z.string().optional(),
});

// Get dashboard statistics
router.get('/stats', async (req: Request, res: Response) => {
    try {
        // Get total users count
        const [userStats] = await db
            .select({ count: count() })
            .from(users);

        // Get total contacts count
        const [contactStats] = await db
            .select({ count: count() })
            .from(contacts);

        // Get total searches count
        const [searchStats] = await db
            .select({ count: count() })
            .from(searchHistory);

        // Get total credits distributed
        const [creditsStats] = await db
            .select({ total: sum(users.credits) })
            .from(users);

        // Get recent signups (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [recentSignups] = await db
            .select({ count: count() })
            .from(users)
            .where(sql`${users.createdAt} >= ${sevenDaysAgo}`);

        // Get recent searches (last 7 days)
        const [recentSearches] = await db
            .select({ count: count() })
            .from(searchHistory)
            .where(sql`${searchHistory.createdAt} >= ${sevenDaysAgo}`);

        // Get credits transactions stats
        const [purchaseStats] = await db
            .select({ total: sum(creditTransactions.amount) })
            .from(creditTransactions)
            .where(eq(creditTransactions.type, 'purchase'));

        const [usageStats] = await db
            .select({ total: sum(sql`ABS(${creditTransactions.amount})`) })
            .from(creditTransactions)
            .where(eq(creditTransactions.type, 'usage'));

        res.json({
            totalUsers: userStats.count,
            totalContacts: contactStats.count,
            totalSearches: searchStats.count,
            totalCreditsDistributed: Number(creditsStats.total) || 0,
            recentSignups: recentSignups.count,
            recentSearches: recentSearches.count,
            totalPurchasedCredits: Number(purchaseStats.total) || 0,
            totalUsedCredits: Number(usageStats.total) || 0,
        });
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users with pagination
router.get('/users', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const allUsers = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
                credits: users.credits,
                isActive: users.isActive,
                onboardingCompleted: users.onboardingCompleted,
                company: users.company,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
            })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset);

        // Get total count for pagination
        const [{ total }] = await db
            .select({ total: count() })
            .from(users);

        res.json({
            users: allUsers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get admin users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single user details
router.get('/users/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's search count
        const [searchCount] = await db
            .select({ count: count() })
            .from(searchHistory)
            .where(eq(searchHistory.userId, id));

        // Get user's contact count
        const [contactCount] = await db
            .select({ count: count() })
            .from(contacts)
            .where(eq(contacts.userId, id));

        // Get user's transaction count
        const [transactionCount] = await db
            .select({ count: count() })
            .from(creditTransactions)
            .where(eq(creditTransactions.userId, id));

        res.json({
            user,
            stats: {
                totalSearches: searchCount.count,
                totalContacts: contactCount.count,
                totalTransactions: transactionCount.count,
            },
        });
    } catch (error) {
        console.error('Get admin user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user
router.patch('/users/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = updateUserSchema.parse(req.body);

        const [updatedUser] = await db
            .update(users)
            .set({
                ...updates,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning();

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: updatedUser });
    } catch (error) {
        console.error('Update admin user error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add credits to user
router.post('/users/:id/credits', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount, description } = addCreditsSchema.parse(req.body);

        // Get current user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user credits
        const [updatedUser] = await db
            .update(users)
            .set({
                credits: user.credits + amount,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning();

        // Create transaction record
        await db
            .insert(creditTransactions)
            .values({
                userId: id,
                amount,
                type: 'bonus',
                description: description || 'Admin credit adjustment',
            });

        res.json({ user: updatedUser });
    } catch (error) {
        console.error('Add credits error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all contacts with pagination
router.get('/contacts', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const allContacts = await db
            .select({
                id: contacts.id,
                title: contacts.title,
                category: contacts.category,
                address: contacts.address,
                phone: contacts.phone,
                email: contacts.email,
                website: contacts.website,
                rating: contacts.rating,
                reviewCount: contacts.reviewCount,
                createdAt: contacts.createdAt,
                user: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                },
            })
            .from(contacts)
            .innerJoin(users, eq(contacts.userId, users.id))
            .orderBy(desc(contacts.createdAt))
            .limit(limit)
            .offset(offset);

        // Get total count
        const [{ total }] = await db
            .select({ total: count() })
            .from(contacts);

        res.json({
            contacts: allContacts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get admin contacts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all searches with pagination
router.get('/searches', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;
        const search = req.query.search as string;
        const offset = (page - 1) * limit;

        const validStatuses = ['pending', 'running', 'completed', 'failed', 'paused'];
        const statusFilter = status && validStatuses.includes(status) ? status : null;

        const allSearches = await db
            .select({
                id: searchHistory.id,
                query: searchHistory.query,
                location: searchHistory.location,
                requestedMaxResults: searchHistory.requestedMaxResults,
                requestEnrichment: searchHistory.requestEnrichment,
                status: searchHistory.status,
                apifyRunId: searchHistory.apifyRunId,
                apifyActorId: searchHistory.apifyActorId,
                apifyActorName: searchHistory.apifyActorName,
                apifyDatasetId: searchHistory.apifyDatasetId,
                apifyStatusMessage: searchHistory.apifyStatusMessage,
                apifyUsageUsd: searchHistory.apifyUsageUsd,
                creditsUsed: searchHistory.creditsUsed,
                totalResults: searchHistory.totalResults,
                standardResultsCount: searchHistory.standardResultsCount,
                enrichedResultsCount: searchHistory.enrichedResultsCount,
                createdAt: searchHistory.createdAt,
                completedAt: searchHistory.completedAt,
                user: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                },
            })
            .from(searchHistory)
            .innerJoin(users, eq(searchHistory.userId, users.id))
            .where(statusFilter ? eq(searchHistory.status, statusFilter as 'pending' | 'running' | 'completed' | 'failed' | 'paused') : sql`1=1`)
            .orderBy(desc(searchHistory.createdAt))
            .limit(limit)
            .offset(offset);

        let filteredSearches = allSearches;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredSearches = allSearches.filter(s => 
                s.query.toLowerCase().includes(searchLower) ||
                s.location.toLowerCase().includes(searchLower) ||
                s.user.name.toLowerCase().includes(searchLower) ||
                s.user.email.toLowerCase().includes(searchLower)
            );
        }

        // Get total count
        const [{ total }] = await db
            .select({ total: count() })
            .from(searchHistory);

        res.json({
            searches: filteredSearches,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get admin searches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get searches timeline (last 100 searches)
router.get('/searches/timeline', async (req: Request, res: Response) => {
    try {
        const recentSearches = await db
            .select({
                id: searchHistory.id,
                status: searchHistory.status,
                createdAt: searchHistory.createdAt,
            })
            .from(searchHistory)
            .orderBy(desc(searchHistory.createdAt))
            .limit(100);

        const stats = {
            total: recentSearches.length,
            completed: recentSearches.filter(s => s.status === 'completed').length,
            failed: recentSearches.filter(s => s.status === 'failed').length,
            running: recentSearches.filter(s => s.status === 'running').length,
            pending: recentSearches.filter(s => s.status === 'pending').length,
            paused: recentSearches.filter(s => s.status === 'paused').length,
        };

        res.json({
            timeline: recentSearches,
            stats,
        });
    } catch (error) {
        console.error('Get searches timeline error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all transactions with pagination
router.get('/transactions', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const allTransactions = await db
            .select({
                id: creditTransactions.id,
                amount: creditTransactions.amount,
                type: creditTransactions.type,
                description: creditTransactions.description,
                createdAt: creditTransactions.createdAt,
                user: {
                    id: users.id,
                    name: users.name,
                    email: users.email,
                },
            })
            .from(creditTransactions)
            .innerJoin(users, eq(creditTransactions.userId, users.id))
            .orderBy(desc(creditTransactions.createdAt))
            .limit(limit)
            .offset(offset);

        // Get total count
        const [{ total }] = await db
            .select({ total: count() })
            .from(creditTransactions);

        res.json({
            transactions: allTransactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get admin transactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user (soft delete by setting isActive to false)
router.delete('/users/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Prevent deleting yourself
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const [deletedUser] = await db
            .update(users)
            .set({
                isActive: false,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning();

        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deactivated successfully', user: deletedUser });
    } catch (error) {
        console.error('Delete admin user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all credit packages
router.get('/packages', async (req: Request, res: Response) => {
    try {
        const packages = await db
            .select()
            .from(creditPackages)
            .orderBy(creditPackages.sortOrder);

        res.json({ packages });
    } catch (error) {
        console.error('Get admin packages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
