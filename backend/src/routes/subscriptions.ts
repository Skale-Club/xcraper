import 'dotenv/config';
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { subscriptionPlans, users, creditTransactions, settings } from '../db/schema';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { z } from 'zod';
import Stripe from 'stripe';
import { createPortalSession, stripe } from '../services/stripe.js';

const router = Router();

type SubscriptionDetailsResponse = {
    id: string;
    planId: string;
    planName: string;
    status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'unpaid';
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    creditsRemaining: number;
    creditsUsedThisPeriod: number;
    monthlyCredits: number;
};

function getSubscriptionsWebhookSecret(): string | null {
    return process.env.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET
        || process.env.STRIPE_WEBHOOK_SECRET
        || null;
}

function normalizeSubscriptionStatus(
    status: string | null | undefined
): SubscriptionDetailsResponse['status'] {
    switch (status) {
        case 'active':
        case 'canceled':
        case 'past_due':
        case 'incomplete':
        case 'trialing':
        case 'unpaid':
            return status;
        default:
            return 'incomplete';
    }
}

function toIsoString(value: Date | number | null | undefined): string | undefined {
    if (!value) {
        return undefined;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return new Date(value * 1000).toISOString();
}

async function getStripeSubscription(stripeSubscriptionId: string | null): Promise<Stripe.Subscription | null> {
    if (!stripe || !stripeSubscriptionId) {
        return null;
    }

    try {
        return await stripe.subscriptions.retrieve(stripeSubscriptionId);
    } catch (error) {
        console.error('Retrieve Stripe subscription error:', error);
        return null;
    }
}

async function findUserByStripeReference(
    customerId?: string | null,
    subscriptionId?: string | null
) {
    if (subscriptionId) {
        const [bySubscription] = await db
            .select()
            .from(users)
            .where(eq(users.stripeSubscriptionId, subscriptionId))
            .limit(1);

        if (bySubscription) {
            return bySubscription;
        }
    }

    if (customerId) {
        const [byCustomer] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1);

        if (byCustomer) {
            return byCustomer;
        }
    }

    return null;
}

async function buildSubscriptionResponse(
    userId: string,
    stripeSubscriptionOverride?: Stripe.Subscription | null
): Promise<SubscriptionDetailsResponse | null> {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user || !user.subscriptionPlanId) {
        return null;
    }

    const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
        .limit(1);

    if (!plan) {
        return null;
    }

    const stripeSubscription = stripeSubscriptionOverride ?? await getStripeSubscription(user.stripeSubscriptionId);

    return {
        id: user.stripeSubscriptionId ?? plan.id,
        planId: plan.id,
        planName: plan.name,
        status: normalizeSubscriptionStatus(stripeSubscription?.status ?? user.subscriptionStatus),
        currentPeriodStart: toIsoString(stripeSubscription?.current_period_start ?? user.billingCycleStart),
        currentPeriodEnd: toIsoString(stripeSubscription?.current_period_end ?? user.billingCycleEnd),
        cancelAtPeriodEnd: stripeSubscription?.cancel_at_period_end ?? false,
        creditsRemaining: user.credits + user.rolloverCredits + user.purchasedCredits,
        creditsUsedThisPeriod: user.monthlyCreditsUsed,
        monthlyCredits: plan.monthlyCredits,
    };
}

async function preserveLegacyPermanentCredits(userId: string): Promise<void> {
    const [user] = await db
        .select({
            credits: users.credits,
            purchasedCredits: users.purchasedCredits,
            subscriptionPlanId: users.subscriptionPlanId,
            stripeSubscriptionId: users.stripeSubscriptionId,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new Error('User not found');
    }

    if (
        user.credits > 0
        && user.purchasedCredits === 0
        && !user.subscriptionPlanId
        && !user.stripeSubscriptionId
    ) {
        await db
            .update(users)
            .set({
                credits: 0,
                purchasedCredits: user.credits,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
    }
}

async function syncUserSubscriptionState(
    userId: string,
    plan: typeof subscriptionPlans.$inferSelect,
    stripeSubscription: Stripe.Subscription,
    stripeCustomerId?: string | null,
): Promise<void> {
    await db
        .update(users)
        .set({
            subscriptionPlanId: plan.id,
            subscriptionStatus: normalizeSubscriptionStatus(stripeSubscription.status),
            stripeCustomerId: stripeCustomerId ?? (typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : null),
            stripeSubscriptionId: stripeSubscription.id,
            billingCycleStart: stripeSubscription.current_period_start
                ? new Date(stripeSubscription.current_period_start * 1000)
                : null,
            billingCycleEnd: stripeSubscription.current_period_end
                ? new Date(stripeSubscription.current_period_end * 1000)
                : null,
            monthlyCreditsUsed: 0,
            autoTopUpEnabled: plan.allowAutoTopUp,
            monthlyTopUpCap: plan.defaultMonthlyTopUpCap,
            topUpThreshold: plan.topUpThreshold,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
}

async function applyPaidInvoiceToUser(
    userId: string,
    plan: typeof subscriptionPlans.$inferSelect,
    invoice: Stripe.Invoice,
    stripeSubscription?: Stripe.Subscription | null,
): Promise<number> {
    if (invoice.status !== 'paid') {
        return 0;
    }

    const [existingGrant] = await db
        .select({ id: creditTransactions.id })
        .from(creditTransactions)
        .where(and(
            eq(creditTransactions.type, 'monthly_grant'),
            eq(creditTransactions.stripeInvoiceId, invoice.id)
        ))
        .limit(1);

    if (existingGrant) {
        return 0;
    }

    const resolvedSubscription = stripeSubscription ?? (
        typeof invoice.subscription === 'string'
            ? await stripe?.subscriptions.retrieve(invoice.subscription)
            : null
    );

    const periodStart = resolvedSubscription?.current_period_start
        ? new Date(resolvedSubscription.current_period_start * 1000)
        : new Date();
    const periodEnd = resolvedSubscription?.current_period_end
        ? new Date(resolvedSubscription.current_period_end * 1000)
        : null;

    await db
        .update(users)
        .set({
            billingCycleStart: periodStart,
            billingCycleEnd: periodEnd,
            monthlyCreditsUsed: 0,
            credits: plan.monthlyCredits,
            subscriptionStatus: normalizeSubscriptionStatus(resolvedSubscription?.status ?? 'active'),
            stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : null,
            stripeSubscriptionId: resolvedSubscription?.id ?? null,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    await db.insert(creditTransactions).values({
        userId,
        amount: plan.monthlyCredits,
        type: 'monthly_grant',
        description: `Monthly credits from ${plan.name} subscription`,
        subscriptionPlanId: plan.id,
        stripeInvoiceId: invoice.id,
        moneyAmount: invoice.amount_paid !== null && invoice.amount_paid !== undefined
            ? (invoice.amount_paid / 100).toFixed(2)
            : null,
        currency: invoice.currency ?? 'usd',
        metadata: {
            billingCycleStart: periodStart.toISOString(),
            billingCycleEnd: periodEnd?.toISOString(),
            invoiceId: invoice.id,
        },
    });

    return plan.monthlyCredits;
}

async function syncSubscriptionCheckoutSession(
    sessionId: string,
    expectedUserId?: string,
): Promise<{ subscription: SubscriptionDetailsResponse | null; creditsGranted: number }> {
    if (!stripe) {
        throw new Error('Payment system not configured');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const { userId, planId } = session.metadata || {};

    if (session.mode !== 'subscription' || !userId || !planId || !session.subscription) {
        throw new Error('Invalid subscription checkout session');
    }

    if (expectedUserId && userId !== expectedUserId) {
        throw new Error('Session does not belong to this user');
    }

    if (session.payment_status !== 'paid') {
        throw new Error('Subscription checkout is not paid');
    }

    const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);

    if (!plan) {
        throw new Error('Subscription plan not found');
    }

    await preserveLegacyPermanentCredits(userId);

    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);

    await syncUserSubscriptionState(
        userId,
        plan,
        stripeSubscription,
        typeof session.customer === 'string' ? session.customer : null,
    );

    const invoiceId = typeof session.invoice === 'string'
        ? session.invoice
        : session.invoice?.id
            ?? (typeof stripeSubscription.latest_invoice === 'string'
                ? stripeSubscription.latest_invoice
                : stripeSubscription.latest_invoice?.id);

    let creditsGranted = 0;
    if (invoiceId) {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        creditsGranted = await applyPaidInvoiceToUser(userId, plan, invoice, stripeSubscription);
    }

    const subscription = await buildSubscriptionResponse(userId, stripeSubscription);

    return {
        subscription,
        creditsGranted,
    };
}

// Schema validation
const createPlanSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.string().regex(/^\d+(\.\d{2})?$/),
    billingInterval: z.enum(['monthly', 'yearly']),
    monthlyCredits: z.number().int().positive(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    allowAutoTopUp: z.boolean().optional(),
    allowManualPurchase: z.boolean().optional(),
    allowOverage: z.boolean().optional(),
    defaultTopUpCredits: z.number().int().positive().optional(),
    defaultTopUpPrice: z.string().optional(),
    defaultMonthlyTopUpCap: z.string().optional(),
    topUpThreshold: z.number().int().positive().optional(),
    allowRollover: z.boolean().optional(),
    maxRolloverCredits: z.number().int().positive().optional(),
    rolloverExpirationDays: z.number().int().positive().optional(),
    trialDays: z.number().int().positive().optional(),
    trialCredits: z.number().int().positive().optional(),
    internalNotes: z.string().optional(),
    estimatedCostPerCredit: z.string().optional(),
});

const updatePlanSchema = createPlanSchema.partial();

// ==================== PUBLIC ROUTES ====================

// Get public subscription plans (for pricing page)
router.get('/public', async (req: Request, res: Response) => {
    try {
        const plans = await db
            .select({
                id: subscriptionPlans.id,
                name: subscriptionPlans.name,
                description: subscriptionPlans.description,
                price: subscriptionPlans.price,
                billingInterval: subscriptionPlans.billingInterval,
                monthlyCredits: subscriptionPlans.monthlyCredits,
                displayOrder: subscriptionPlans.displayOrder,
                isPopular: sql<boolean>`false`, // Can be computed based on some logic
                allowAutoTopUp: subscriptionPlans.allowAutoTopUp,
                allowManualPurchase: subscriptionPlans.allowManualPurchase,
                allowOverage: subscriptionPlans.allowOverage,
                defaultTopUpCredits: subscriptionPlans.defaultTopUpCredits,
                defaultTopUpPrice: subscriptionPlans.defaultTopUpPrice,
                defaultMonthlyTopUpCap: subscriptionPlans.defaultMonthlyTopUpCap,
                topUpThreshold: subscriptionPlans.topUpThreshold,
                allowRollover: subscriptionPlans.allowRollover,
                maxRolloverCredits: subscriptionPlans.maxRolloverCredits,
                rolloverExpirationDays: subscriptionPlans.rolloverExpirationDays,
                trialDays: subscriptionPlans.trialDays,
                trialCredits: subscriptionPlans.trialCredits,
            })
            .from(subscriptionPlans)
            .where(and(
                eq(subscriptionPlans.isActive, true),
                eq(subscriptionPlans.isPublic, true)
            ))
            .orderBy(subscriptionPlans.displayOrder);

        res.json({ plans });
    } catch (error) {
        console.error('Get public plans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== AUTHENTICATED ROUTES ====================

// Get current user's subscription
router.get('/me', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const subscription = await buildSubscriptionResponse(userId);

        if (!subscription) {
            return res.status(404).json({ error: 'No active subscription found' });
        }

        res.json(subscription);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Subscribe to a plan
router.post('/subscribe', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { planId } = z.object({ planId: z.string().uuid() }).parse(req.body);

        if (!stripe) {
            return res.status(500).json({ error: 'Payment system not configured' });
        }

        // Get the plan
        const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId))
            .limit(1);

        if (!plan || !plan.isActive) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        // Validate plan has Stripe price configured
        if (!plan.stripePriceId) {
            return res.status(400).json({ error: 'Plan not properly configured with Stripe. Please contact support.' });
        }

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create or get Stripe customer
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.company?.trim() || undefined,
                metadata: {
                    userId: user.id,
                },
            });
            customerId = customer.id;

            // Update user with Stripe customer ID
            await db
                .update(users)
                .set({ stripeCustomerId: customerId })
                .where(eq(users.id, userId));
        }

        // Create Stripe checkout session for subscription
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: plan.stripePriceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.FRONTEND_URL}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/billing?checkout=canceled`,
            metadata: {
                userId: user.id,
                planId: plan.id,
            },
        });

        res.json({
            url: checkoutSession.url,
            sessionId: checkoutSession.id,
        });
    } catch (error) {
        console.error('Subscribe error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel subscription
router.post('/cancel', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user || !user.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No active subscription' });
        }

        if (!stripe) {
            return res.status(500).json({ error: 'Payment system not configured' });
        }

        // Cancel at period end (don't immediately revoke access)
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        const subscription = await buildSubscriptionResponse(userId);

        res.json({
            message: 'Subscription will be canceled at the end of the billing period',
            subscription,
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reactivate canceled subscription
router.post('/reactivate', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user || !user.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No subscription to reactivate' });
        }

        if (!stripe) {
            return res.status(500).json({ error: 'Payment system not configured' });
        }

        // Remove cancel_at_period_end flag
        const stripeSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: false,
        });

        const subscription = await buildSubscriptionResponse(userId, stripeSubscription);

        res.json({ message: 'Subscription reactivated', subscription });
    } catch (error) {
        console.error('Reactivate subscription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/verify/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.params);

        const result = await syncSubscriptionCheckoutSession(sessionId, userId);

        res.json({
            message: result.creditsGranted > 0
                ? 'Subscription synchronized and credits granted'
                : 'Subscription synchronized',
            subscription: result.subscription,
            creditsGranted: result.creditsGranted,
        });
    } catch (error) {
        console.error('Verify subscription checkout error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }

        return res.status(400).json({
            error: error instanceof Error ? error.message : 'Failed to verify subscription checkout',
        });
    }
});

router.post('/portal', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const [user] = await db
            .select({
                stripeCustomerId: users.stripeCustomerId,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user?.stripeCustomerId) {
            return res.status(400).json({ error: 'No Stripe customer found for this user' });
        }

        const portal = await createPortalSession(user.stripeCustomerId);

        if (!portal?.url) {
            return res.status(500).json({ error: 'Failed to create portal session' });
        }

        res.json({ url: portal.url });
    } catch (error) {
        console.error('Subscription portal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update auto top-up settings
router.patch('/auto-topup', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { enabled, threshold, monthlyCap } = z.object({
            enabled: z.boolean().optional(),
            threshold: z.number().int().min(0).optional(),
            monthlyCap: z.string().optional(),
        }).parse(req.body);

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user's plan allows auto top-up
        if (user.subscriptionPlanId) {
            const [plan] = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .limit(1);

            if (plan && !plan.allowAutoTopUp && enabled) {
                return res.status(400).json({ error: 'Your plan does not support auto top-up' });
            }
        }

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (enabled !== undefined) updates.autoTopUpEnabled = enabled;
        if (threshold !== undefined) updates.topUpThreshold = threshold;
        if (monthlyCap !== undefined) updates.monthlyTopUpCap = monthlyCap;

        const [updatedUser] = await db
            .update(users)
            .set(updates)
            .where(eq(users.id, userId))
            .returning();

        res.json({ user: updatedUser });
    } catch (error) {
        console.error('Update auto top-up error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== ADMIN ROUTES ====================

// Get all subscription plans (admin)
router.get('/admin/plans', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const plans = await db
            .select()
            .from(subscriptionPlans)
            .orderBy(subscriptionPlans.displayOrder);

        // Get subscriber count for each plan
        const plansWithCounts = await Promise.all(
            plans.map(async (plan) => {
                const [{ count }] = await db
                    .select({ count: sql<number>`count(*)::int` })
                    .from(users)
                    .where(eq(users.subscriptionPlanId, plan.id));

                return {
                    ...plan,
                    subscriberCount: count,
                };
            })
        );

        res.json({ plans: plansWithCounts });
    } catch (error) {
        console.error('Get admin plans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create subscription plan (admin)
router.post('/admin/plans', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = createPlanSchema.parse(req.body);

        // Create Stripe product and price if Stripe is configured
        let stripeProductId: string | undefined;
        let stripePriceId: string | undefined;

        if (stripe) {
            const product = await stripe.products.create({
                name: data.name,
                description: data.description,
                metadata: {
                    monthlyCredits: data.monthlyCredits.toString(),
                },
            });
            stripeProductId = product.id;

            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(parseFloat(data.price) * 100), // Convert to cents
                currency: 'usd',
                recurring: {
                    interval: data.billingInterval === 'yearly' ? 'year' : 'month',
                },
            });
            stripePriceId = price.id;
        }

        const [plan] = await db
            .insert(subscriptionPlans)
            .values({
                ...data,
                stripeProductId,
                stripePriceId,
                displayOrder: data.displayOrder ?? 0,
            })
            .returning();

        res.status(201).json({ plan });
    } catch (error) {
        console.error('Create plan error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update subscription plan (admin)
router.patch('/admin/plans/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = updatePlanSchema.parse(req.body);

        const [updatedPlan] = await db
            .update(subscriptionPlans)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(subscriptionPlans.id, id))
            .returning();

        if (!updatedPlan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        res.json({ plan: updatedPlan });
    } catch (error) {
        console.error('Update plan error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete subscription plan (admin)
router.delete('/admin/plans/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if any users are on this plan
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(users)
            .where(eq(users.subscriptionPlanId, id));

        if (count > 0) {
            return res.status(400).json({
                error: 'Cannot delete plan with active subscribers. Deactivate it instead.'
            });
        }

        const [deletedPlan] = await db
            .delete(subscriptionPlans)
            .where(eq(subscriptionPlans.id, id))
            .returning();

        if (!deletedPlan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        res.json({ message: 'Plan deleted', plan: deletedPlan });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Assign plan to user (admin)
router.post('/admin/assign-plan', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { userId, planId, grantCreditsImmediately } = z.object({
            userId: z.string().uuid(),
            planId: z.string().uuid(),
            grantCreditsImmediately: z.boolean().optional().default(true),
        }).parse(req.body);

        const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId))
            .limit(1);

        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        const now = new Date();
        const cycleEnd = new Date(now);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);

        const updates: Record<string, unknown> = {
            subscriptionPlanId: planId,
            subscriptionStatus: 'active',
            billingCycleStart: now,
            billingCycleEnd: cycleEnd,
            monthlyCreditsUsed: 0,
            autoTopUpEnabled: plan.allowAutoTopUp,
            monthlyTopUpCap: plan.defaultMonthlyTopUpCap,
            topUpThreshold: plan.topUpThreshold,
            updatedAt: now,
        };

        if (grantCreditsImmediately) {
            updates.credits = plan.monthlyCredits;
        }

        const [updatedUser] = await db
            .update(users)
            .set(updates)
            .where(eq(users.id, userId))
            .returning();

        // Log credit grant if applicable
        if (grantCreditsImmediately && plan.monthlyCredits > 0) {
            await db.insert(creditTransactions).values({
                userId,
                amount: plan.monthlyCredits,
                type: 'monthly_grant',
                description: `Monthly credits from ${plan.name} plan`,
                subscriptionPlanId: planId,
                metadata: {
                    billingCycleStart: now.toISOString(),
                    billingCycleEnd: cycleEnd.toISOString(),
                },
            });
        }

        res.json({ user: updatedUser });
    } catch (error) {
        console.error('Assign plan error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get subscribers overview (admin)
router.get('/admin/subscribers', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const subscribers = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                subscriptionStatus: users.subscriptionStatus,
                credits: users.credits,
                billingCycleStart: users.billingCycleStart,
                billingCycleEnd: users.billingCycleEnd,
                createdAt: users.createdAt,
                plan: {
                    id: subscriptionPlans.id,
                    name: subscriptionPlans.name,
                    price: subscriptionPlans.price,
                },
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
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get subscribers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== WEBHOOK ROUTE ====================

// Stripe webhook endpoint for subscription events (no auth required - verified by signature)
// Note: This needs to be registered with raw body parser in index.ts
router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const signature = req.headers['stripe-signature'] as string;

        if (!signature) {
            return res.status(400).json({ error: 'Missing Stripe signature' });
        }

        if (!stripe) {
            return res.status(500).json({ error: 'Payment system not configured' });
        }

        const webhookSecret = getSubscriptionsWebhookSecret();
        if (!webhookSecret) {
            console.error('Subscription webhook secret not configured');
            return res.status(500).json({ error: 'Webhook not configured' });
        }

        // req.body should be raw buffer when using express.raw middleware
        const payload = req.body;

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err);
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        // Handle subscription-specific events
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const { userId, planId } = session.metadata || {};

                if (session.mode === 'subscription' && userId && planId && session.subscription) {
                    await preserveLegacyPermanentCredits(userId);

                    // Get the plan
                    const [plan] = await db
                        .select()
                        .from(subscriptionPlans)
                        .where(eq(subscriptionPlans.id, planId))
                        .limit(1);

                    if (plan) {
                        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);

                        // Update user subscription
                        await db
                            .update(users)
                            .set({
                                subscriptionPlanId: planId,
                                subscriptionStatus: normalizeSubscriptionStatus(stripeSubscription.status),
                                stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
                                stripeSubscriptionId: session.subscription as string,
                                billingCycleStart: stripeSubscription.current_period_start
                                    ? new Date(stripeSubscription.current_period_start * 1000)
                                    : null,
                                billingCycleEnd: stripeSubscription.current_period_end
                                    ? new Date(stripeSubscription.current_period_end * 1000)
                                    : null,
                                monthlyCreditsUsed: 0,
                                autoTopUpEnabled: plan.allowAutoTopUp,
                                monthlyTopUpCap: plan.defaultMonthlyTopUpCap,
                                topUpThreshold: plan.topUpThreshold,
                                updatedAt: new Date(),
                            })
                            .where(eq(users.id, userId));

                        console.log(`Subscription synced for user ${userId}, plan ${plan.name}`);
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                const user = await findUserByStripeReference(customerId, subscription.id);

                if (user) {
                    await db
                        .update(users)
                        .set({
                            subscriptionStatus: normalizeSubscriptionStatus(subscription.status),
                            stripeCustomerId: customerId,
                            stripeSubscriptionId: subscription.id,
                            billingCycleStart: subscription.current_period_start
                                ? new Date(subscription.current_period_start * 1000)
                                : user.billingCycleStart,
                            billingCycleEnd: subscription.current_period_end
                                ? new Date(subscription.current_period_end * 1000)
                                : user.billingCycleEnd,
                            updatedAt: new Date(),
                        })
                        .where(eq(users.id, user.id));

                    console.log(`Subscription updated for user ${user.id}, status: ${subscription.status}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                const user = await findUserByStripeReference(customerId, subscription.id);

                if (user) {
                    await db
                        .update(users)
                        .set({
                            subscriptionStatus: 'canceled',
                            subscriptionPlanId: null,
                            stripeSubscriptionId: null,
                            billingCycleStart: null,
                            billingCycleEnd: null,
                            updatedAt: new Date(),
                        })
                        .where(eq(users.id, user.id));

                    console.log(`Subscription canceled for user ${user.id}`);
                }
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;
                const subscriptionId = typeof invoice.subscription === 'string'
                    ? invoice.subscription
                    : invoice.subscription?.id;

                const user = await findUserByStripeReference(customerId, subscriptionId);

                if (user && user.subscriptionPlanId) {
                    const [existingGrant] = await db
                        .select({ id: creditTransactions.id })
                        .from(creditTransactions)
                        .where(and(
                            eq(creditTransactions.type, 'monthly_grant'),
                            eq(creditTransactions.stripeInvoiceId, invoice.id)
                        ))
                        .limit(1);

                    if (existingGrant) {
                        console.log(`Invoice ${invoice.id} already processed for user ${user.id}`);
                        break;
                    }

                    // Get the plan
                    const [plan] = await db
                        .select()
                        .from(subscriptionPlans)
                        .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                        .limit(1);

                    if (plan) {
                        const stripeSubscription = subscriptionId
                            ? await stripe.subscriptions.retrieve(subscriptionId)
                            : null;
                        const periodStart = stripeSubscription?.current_period_start
                            ? new Date(stripeSubscription.current_period_start * 1000)
                            : new Date();
                        const periodEnd = stripeSubscription?.current_period_end
                            ? new Date(stripeSubscription.current_period_end * 1000)
                            : null;

                        // Reset billing cycle and grant credits
                        await db
                            .update(users)
                            .set({
                                billingCycleStart: periodStart,
                                billingCycleEnd: periodEnd,
                                monthlyCreditsUsed: 0,
                                credits: plan.monthlyCredits,
                                subscriptionStatus: normalizeSubscriptionStatus(stripeSubscription?.status ?? 'active'),
                                stripeCustomerId: customerId,
                                stripeSubscriptionId: subscriptionId ?? user.stripeSubscriptionId,
                                updatedAt: new Date(),
                            })
                            .where(eq(users.id, user.id));

                        // Log credit grant
                        await db.insert(creditTransactions).values({
                            userId: user.id,
                            amount: plan.monthlyCredits,
                            type: 'monthly_grant',
                            description: `Monthly credits from ${plan.name} subscription`,
                            subscriptionPlanId: plan.id,
                            stripeInvoiceId: invoice.id,
                            moneyAmount: invoice.amount_paid !== null && invoice.amount_paid !== undefined
                                ? (invoice.amount_paid / 100).toFixed(2)
                                : null,
                            currency: invoice.currency ?? 'usd',
                            metadata: {
                                billingCycleStart: periodStart.toISOString(),
                                billingCycleEnd: periodEnd?.toISOString(),
                                invoiceId: invoice.id,
                            },
                        });

                        console.log(`Monthly credits granted to user ${user.id}: ${plan.monthlyCredits}`);
                    }
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;
                const subscriptionId = typeof invoice.subscription === 'string'
                    ? invoice.subscription
                    : invoice.subscription?.id;

                const user = await findUserByStripeReference(customerId, subscriptionId);

                if (user) {
                    await db
                        .update(users)
                        .set({
                            subscriptionStatus: 'past_due',
                            updatedAt: new Date(),
                        })
                        .where(eq(users.id, user.id));

                    console.log(`Payment failed for user ${user.id}`);
                }
                break;
            }

            default:
                console.log(`Unhandled subscription event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Subscription webhook error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Webhook processing failed'
        });
    }
});

export default router;
