import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, subscriptionPlans, creditPackages } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { reportingService } from '../services/reporting.js';
import { spendingCapService } from '../services/spendingCap.js';
import { creditRulesService } from '../services/creditRules.js';
import { billingAlertService, AlertType } from '../services/billingAlerts.js';
import { auditLogService } from '../services/auditLog.js';

const router = Router();

router.get('/overview', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const overview = await reportingService.getRevenueOverview();
        res.json(overview);
    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/mrr', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const months = parseInt(req.query.months as string) || 12;
        const trend = await reportingService.getMRRTrend(months);
        res.json({ trend });
    } catch (error) {
        console.error('Get MRR error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/subscribers', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const subscribers = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                subscriptionStatus: users.subscriptionStatus,
                credits: users.credits,
                rolloverCredits: users.rolloverCredits,
                purchasedCredits: users.purchasedCredits,
                billingCycleStart: users.billingCycleStart,
                billingCycleEnd: users.billingCycleEnd,
                accountRiskFlag: users.accountRiskFlag,
                createdAt: users.createdAt,
            })
            .from(users)
            .leftJoin(subscriptionPlans, eq(users.subscriptionPlanId, subscriptionPlans.id))
            .where(sql`${users.subscriptionPlanId} IS NOT NULL`)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ total }] = await db
            .select({ total: sql<number>`count(*)::int` })
            .from(users)
            .where(sql`${users.subscriptionPlanId} IS NOT NULL`);

        res.json({
            subscribers,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Get subscribers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/usage', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const usage = await reportingService.getUsageReport(startDate, endDate);
        res.json(usage);
    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/profitability', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const userId = req.query.userId as string | undefined;
        if (userId) {
            const profitability = await reportingService.getUserProfitability(userId);
            res.json(profitability);
        } else {
            const allProfitability = await reportingService.getAllProfitability();
            res.json({ users: allProfitability });
        }
    } catch (error) {
        console.error('Get profitability error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/topups', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const analytics = await reportingService.getTopUpAnalytics(startDate, endDate);
        res.json(analytics);
    } catch (error) {
        console.error('Get top-ups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/failed-payments', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const failedPayments = await reportingService.getFailedPayments();
        res.json({ users: failedPayments });
    } catch (error) {
        console.error('Get failed payments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/at-risk', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const atRiskUsers = await reportingService.getAtRiskUsers();
        res.json({ users: atRiskUsers });
    } catch (error) {
        console.error('Get at-risk users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/at-cap', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const threshold = parseInt(req.query.threshold as string) || 80;
        const usersAtCap = await spendingCapService.getUsersAtCap(threshold);
        res.json({ users: usersAtCap });
    } catch (error) {
        console.error('Get at-cap users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const setFlagSchema = z.object({
    flag: z.enum(['none', 'review', 'restricted', 'suspended']),
    notes: z.string().optional(),
});

router.post('/user/:userId/flag', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const validationResult = setFlagSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({ error: 'Validation failed', details: validationResult.error.flatten() });
            return;
        }

        const { flag, notes } = validationResult.data;

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await db.update(users)
            .set({ accountRiskFlag: flag, supportNotes: notes || user.supportNotes, updatedAt: new Date() })
            .where(eq(users.id, userId));

        await auditLogService.logAdminAction(req.user!.id, 'set_flag', userId, { previousFlag: user.accountRiskFlag }, { flag, notes }, `Set risk flag to ${flag}`);
        res.json({ message: 'Flag updated successfully', flag });
    } catch (error) {
        console.error('Set flag error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/user/:userId/pause', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;

        await db.update(users).set({ isActive: false, accountRiskFlag: 'restricted', updatedAt: new Date() }).where(eq(users.id, userId));
        await auditLogService.logAdminAction(req.user!.id, 'pause_account', userId, null, null, 'Account paused');
        res.json({ message: 'Account paused' });
    } catch (error) {
        console.error('Pause account error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/user/:userId/resume', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;

        await db.update(users).set({ isActive: true, accountRiskFlag: 'none', updatedAt: new Date() }).where(eq(users.id, userId));
        await auditLogService.logAdminAction(req.user!.id, 'resume_account', userId, null, null, 'Account resumed');
        res.json({ message: 'Account resumed' });
    } catch (error) {
        console.error('Resume account error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/user/:userId/cap', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { cap } = z.object({ cap: z.number().min(0) }).parse(req.body);

        await spendingCapService.setCapOverride(userId, cap, req.user!.id);
        await auditLogService.logAdminAction(req.user!.id, 'set_cap', userId, null, { cap }, `Set cap override to $${cap}`);
        res.json({ message: 'Cap updated successfully', cap });
    } catch (error) {
        console.error('Set cap error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/user/:userId/cap', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        await spendingCapService.removeCapOverride(userId);
        await auditLogService.logAdminAction(req.user!.id, 'remove_cap', userId, null, null, 'Removed cap override');
        res.json({ message: 'Cap override removed' });
    } catch (error) {
        console.error('Remove cap error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/credit-rules', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const rules = await creditRulesService.getPricingRules();
        res.json({ rules });
    } catch (error) {
        console.error('Get credit rules error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const updateCreditRulesSchema = z.object({
    creditsPerStandardResult: z.number().int().min(1).optional(),
    creditsPerEnrichedResult: z.number().int().min(1).optional(),
    enrichmentPricingMode: z.enum(['fixed', 'base_plus_enrichment']).optional(),
    chargeForDuplicates: z.boolean().optional(),
    duplicateWindowDays: z.number().int().min(0).optional(),
});

router.patch('/credit-rules', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const validationResult = updateCreditRulesSchema.safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({ error: 'Validation failed', details: validationResult.error.flatten() });
            return;
        }
        const rules = await creditRulesService.updatePricingRules(validationResult.data);
        res.json({ rules });
    } catch (error) {
        console.error('Update credit rules error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/alerts/config', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const alertTypes: AlertType[] = ['credits_80', 'credits_100', 'topup_success', 'topup_failed', 'cap_80', 'cap_100', 'renewal_success', 'renewal_failed', 'payment_method_expiring'];
        const configs = await Promise.all(alertTypes.map(async (type) => ({ type, config: await billingAlertService.getAlertConfig(type) })));
        res.json({ alerts: configs });
    } catch (error) {
        console.error('Get alert config error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/alerts/resend/:userId/:alertType', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId, alertType } = req.params;
        const success = await billingAlertService.resendAlert(userId, alertType as AlertType);
        res.json({ success });
    } catch (error) {
        console.error('Resend alert error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/packages', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const packages = await db.select().from(creditPackages).orderBy(creditPackages.sortOrder);
        res.json({ packages });
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const createPackageSchema = z.object({
    name: z.string().min(1),
    credits: z.number().int().min(1),
    price: z.string().regex(/^\d+(\.\d{2})?$/),
    description: z.string().optional(),
    isPopular: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    restrictedToPlanIds: z.array(z.string().uuid()).optional(),
    isPromotional: z.boolean().optional(),
    isHidden: z.boolean().optional(),
    purchaseType: z.enum(['standard', 'promo', 'compensation', 'admin_only']).optional(),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
});

router.post('/packages', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const validationResult = createPackageSchema.safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({ error: 'Validation failed', details: validationResult.error.flatten() });
            return;
        }
        const data = validationResult.data;
        const [pkg] = await db.insert(creditPackages).values({
            name: data.name,
            credits: data.credits,
            price: data.price,
            description: data.description,
            isPopular: data.isPopular ?? false,
            isActive: data.isActive ?? true,
            sortOrder: data.sortOrder ?? 0,
            restrictedToPlanIds: data.restrictedToPlanIds,
            isPromotional: data.isPromotional ?? false,
            isHidden: data.isHidden ?? false,
            purchaseType: data.purchaseType ?? 'standard',
            validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
            validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        }).returning();
        res.status(201).json({ package: pkg });
    } catch (error) {
        console.error('Create package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/packages/:id', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const validationResult = createPackageSchema.partial().safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({ error: 'Validation failed', details: validationResult.error.flatten() });
            return;
        }
        const data = validationResult.data;
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (data.name !== undefined) updateData.name = data.name;
        if (data.credits !== undefined) updateData.credits = data.credits;
        if (data.price !== undefined) updateData.price = data.price;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.isPopular !== undefined) updateData.isPopular = data.isPopular;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
        if (data.restrictedToPlanIds !== undefined) updateData.restrictedToPlanIds = data.restrictedToPlanIds;
        if (data.isPromotional !== undefined) updateData.isPromotional = data.isPromotional;
        if (data.isHidden !== undefined) updateData.isHidden = data.isHidden;
        if (data.purchaseType !== undefined) updateData.purchaseType = data.purchaseType;
        if (data.validFrom !== undefined) updateData.validFrom = new Date(data.validFrom);
        if (data.validUntil !== undefined) updateData.validUntil = new Date(data.validUntil);

        const [updatedPkg] = await db.update(creditPackages).set(updateData).where(eq(creditPackages.id, id)).returning();
        if (!updatedPkg) {
            res.status(404).json({ error: 'Package not found' });
            return;
        }
        res.json({ package: updatedPkg });
    } catch (error) {
        console.error('Update package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/packages/:id', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const [deletedPkg] = await db.update(creditPackages).set({ isActive: false, updatedAt: new Date() }).where(eq(creditPackages.id, id)).returning();
        if (!deletedPkg) {
            res.status(404).json({ error: 'Package not found' });
            return;
        }
        res.json({ message: 'Package deactivated', package: deletedPkg });
    } catch (error) {
        console.error('Delete package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/audit/recent', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const actions = await auditLogService.getRecentActions(limit);
        res.json({ actions });
    } catch (error) {
        console.error('Get recent actions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/audit/admin/:adminId', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { adminId } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;
        const actions = await auditLogService.getAdminActionLog(adminId, limit);
        res.json({ actions });
    } catch (error) {
        console.error('Get admin actions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
