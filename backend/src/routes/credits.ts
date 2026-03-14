import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, creditTransactions, creditPackages, billingEvents } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { creditRulesService } from '../services/creditRules.js';
import { autoTopUpService } from '../services/autoTopUp.js';
import { spendingCapService } from '../services/spendingCap.js';
import { billingAlertService } from '../services/billingAlerts.js';
import { auditLogService } from '../services/auditLog.js';
import { createCheckoutSession } from '../services/stripe.js';

const router = Router();

router.get('/packages', async (req, res: Response): Promise<void> => {
    try {
        let userPlanId: string | undefined;
        
        if (req.user) {
            const [user] = await db
                .select({ subscriptionPlanId: users.subscriptionPlanId })
                .from(users)
                .where(eq(users.id, req.user.id))
                .limit(1);
            userPlanId = user?.subscriptionPlanId ?? undefined;
        }

        const packages = await db
            .select()
            .from(creditPackages)
            .where(eq(creditPackages.isActive, true))
            .orderBy(creditPackages.sortOrder);

        const filteredPackages = packages.filter(pkg => {
            if (pkg.isHidden) return false;
            if (pkg.purchaseType === 'admin_only' && !req.user?.role || req.user?.role !== 'admin') {
                return false;
            }
            if (pkg.validFrom && new Date() < pkg.validFrom) return false;
            if (pkg.validUntil && new Date() > pkg.validUntil) return false;
            if (pkg.restrictedToPlanIds && userPlanId) {
                return pkg.restrictedToPlanIds.includes(userPlanId);
            }
            return true;
        });

        res.json({ packages: filteredPackages });
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/balance', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const balance = await creditRulesService.getUserCreditBalance(req.user.id);
        const topUpSettings = await autoTopUpService.getTopUpSettings(req.user.id);
        const capStatus = await spendingCapService.getCapStatus(req.user.id);

        res.json({
            credits: balance.total,
            breakdown: {
                monthly: balance.monthly,
                rollover: balance.rollover,
                purchased: balance.purchased,
            },
            topUp: topUpSettings,
            cap: capStatus,
        });
    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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

const purchaseSchema = z.object({
    packageId: z.string().uuid(),
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

        const [creditPackage] = await db
            .select()
            .from(creditPackages)
            .where(eq(creditPackages.id, packageId))
            .limit(1);

        if (!creditPackage || !creditPackage.isActive) {
            res.status(400).json({ error: 'Invalid package selected' });
            return;
        }

        if (creditPackage.isHidden || creditPackage.purchaseType === 'admin_only') {
            res.status(400).json({ error: 'Package not available for purchase' });
            return;
        }

        const result = await createCheckoutSession(
            req.user.id,
            req.user.email,
            packageId
        );

        if (!result) {
            res.status(500).json({ error: 'Failed to create checkout session' });
            return;
        }

        res.json({
            message: 'Checkout session created',
            sessionId: result.sessionId,
            url: result.url,
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Internal server error' 
        });
    }
});

router.get('/topup/settings', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const settings = await autoTopUpService.getTopUpSettings(req.user.id);
        res.json({ settings });
    } catch (error) {
        console.error('Get top-up settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const updateTopUpSchema = z.object({
    enabled: z.boolean().optional(),
    threshold: z.number().int().min(0).max(500).optional(),
    blockCredits: z.number().int().min(50).max(1000).optional(),
    blockPrice: z.string().regex(/^\d+(\.\d{2})?$/).optional(),
    monthlyCap: z.string().regex(/^\d+(\.\d{2})?$/).optional(),
});

router.patch('/topup/settings', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const validationResult = updateTopUpSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten()
            });
            return;
        }

        await autoTopUpService.updateTopUpSettings(req.user.id, validationResult.data);
        const settings = await autoTopUpService.getTopUpSettings(req.user.id);

        res.json({ settings });
    } catch (error) {
        console.error('Update top-up settings error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Internal server error' 
        });
    }
});

router.post('/topup/trigger', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const result = await autoTopUpService.checkAndTrigger(req.user.id);
        res.json(result);
    } catch (error) {
        console.error('Trigger top-up error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Internal server error' 
        });
    }
});

router.get('/rules', async (req, res: Response): Promise<void> => {
    try {
        const rules = await creditRulesService.getPricingRules();
        res.json({ rules });
    } catch (error) {
        console.error('Get rules error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const adminAddCreditsSchema = z.object({
    userId: z.string().uuid(),
    amount: z.number().int(),
    type: z.enum(['bonus', 'compensation', 'promotional', 'adjustment']).optional().default('bonus'),
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

        const { userId, amount, type, description } = validationResult.data;

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const absAmount = Math.abs(amount);
        const signedAmount = amount >= 0 ? absAmount : -absAmount;

        const [updatedUser] = await db.update(users)
            .set({
                credits: user.credits + signedAmount,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId))
            .returning();

        await db.insert(creditTransactions).values({
            userId,
            amount: signedAmount,
            type: type,
            description: description || `Admin ${type}: ${signedAmount > 0 ? '+' : ''}${signedAmount} credits`,
            metadata: {
                adminId: req.user!.id,
                source: 'admin_adjustment',
            },
        });

        await auditLogService.logCreditChange(
            userId,
            type as 'adjustment' | 'compensation' | 'promotional',
            signedAmount,
            req.user!.id,
            description
        );

        res.json({
            message: 'Credits adjusted successfully',
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

router.get('/admin/users', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const userList = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                credits: users.credits,
                rolloverCredits: users.rolloverCredits,
                purchasedCredits: users.purchasedCredits,
                subscriptionStatus: users.subscriptionStatus,
                accountRiskFlag: users.accountRiskFlag,
                createdAt: users.createdAt,
            })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset);

        res.json({ users: userList });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/admin/user/:userId/ledger', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;

        const ledger = await auditLogService.getAuditTrail(userId, limit);
        res.json({ ledger });
    } catch (error) {
        console.error('Get ledger error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
