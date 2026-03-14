import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, creditTransactions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Credit packages available for purchase
const CREDIT_PACKAGES = [
    { id: 'starter', credits: 50, price: 9.99 },
    { id: 'basic', credits: 150, price: 24.99 },
    { id: 'pro', credits: 500, price: 74.99 },
    { id: 'enterprise', credits: 1500, price: 199.99 },
];

// Get available credit packages
router.get('/packages', (_req, res: Response): void => {
    res.json({ packages: CREDIT_PACKAGES });
});

// Get user's credit balance
router.get('/balance', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const [user] = await db.select({ credits: users.credits })
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({ credits: user.credits });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get credit transaction history
router.get('/history', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const transactions = await db.select()
            .from(creditTransactions)
            .where(eq(creditTransactions.userId, req.user.id))
            .orderBy(desc(creditTransactions.createdAt))
            .limit(limit)
            .offset(offset);

        res.json({ transactions });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Purchase credits (simulated - integrate with payment provider)
const purchaseSchema = z.object({
    packageId: z.string(),
});

router.post('/purchase', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const validationResult = purchaseSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten()
            });
            return;
        }

        const { packageId } = validationResult.data;

        // Find the package
        const creditPackage = CREDIT_PACKAGES.find(p => p.id === packageId);

        if (!creditPackage) {
            res.status(400).json({ error: 'Invalid package selected' });
            return;
        }

        // Get current user
        const [user] = await db.select()
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // In a real application, you would integrate with a payment provider here
        // For now, we'll simulate a successful purchase

        // Add credits to user
        const [updatedUser] = await db.update(users)
            .set({
                credits: user.credits + creditPackage.credits,
                updatedAt: new Date()
            })
            .where(eq(users.id, req.user.id))
            .returning();

        // Log the transaction
        await db.insert(creditTransactions).values({
            userId: req.user.id,
            amount: creditPackage.credits,
            type: 'purchase',
            description: `Purchased ${creditPackage.credits} credits (${creditPackage.id} package)`,
        });

        res.json({
            message: 'Credits purchased successfully',
            credits: updatedUser.credits,
            added: creditPackage.credits,
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Add credits to user
const adminAddCreditsSchema = z.object({
    userId: z.string().uuid(),
    amount: z.number().int().positive(),
    description: z.string().optional(),
});

router.post('/admin/add', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const validationResult = adminAddCreditsSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten()
            });
            return;
        }

        const { userId, amount, description } = validationResult.data;

        // Get user
        const [user] = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Add credits
        const [updatedUser] = await db.update(users)
            .set({
                credits: user.credits + amount,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId))
            .returning();

        // Log the transaction
        await db.insert(creditTransactions).values({
            userId,
            amount,
            type: 'bonus',
            description: description || `Admin added ${amount} credits`,
        });

        res.json({
            message: 'Credits added successfully',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                credits: updatedUser.credits,
            },
        });
    } catch (error) {
        console.error('Admin add credits error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Get all credit transactions
router.get('/admin/transactions', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const transactions = await db.select()
            .from(creditTransactions)
            .orderBy(desc(creditTransactions.createdAt))
            .limit(limit)
            .offset(offset);

        res.json({ transactions });
    } catch (error) {
        console.error('Get all transactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
