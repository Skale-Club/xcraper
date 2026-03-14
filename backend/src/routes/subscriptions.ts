import 'dotenv/config';
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { subscriptionPlans, users, creditTransactions, settings } from '../db/schema';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { z } from 'zod';
import Stripe from 'stripe';

const router = Router();

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
}) : null;

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

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let plan = null;
        if (user.subscriptionPlanId) {
            [plan] = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .limit(1);
        }

        // Calculate available credits
        const totalCredits = user.credits + user.rolloverCredits + user.purchasedCredits;
        const remainingMonthlyCredits = plan ? Math.max(0, plan.monthlyCredits - user.monthlyCreditsUsed) : 0;

        // Get current month's top-up spend
        const currentMonthSpend = parseFloat(user.currentMonthTopUpSpend || '0');
        const topUpCap = parseFloat(user.monthlyTopUpCap || '0');
        const remainingTopUpCap = Math.max(0, topUpCap - currentMonthSpend);

        res.json({
            subscription: {
                status: user.subscriptionStatus,
                plan: plan ? {
                    id: plan.id,
                    name: plan.name,
                    price: plan.price,
                    billingInterval: plan.billingInterval,
                    monthlyCredits: plan.monthlyCredits,
                } : null,
                billingCycle: {
                    start: user.billingCycleStart,
                    end: user.billingCycleEnd,
                },
                credits: {
                    total: totalCredits,
                    monthly: user.credits,
                    rollover: user.rolloverCredits,
                    purchased: user.purchasedCredits,
                    monthlyUsed: user.monthlyCreditsUsed,
                    monthlyRemaining: remainingMonthlyCredits,
                },
                autoTopUp: {
                    enabled: user.autoTopUpEnabled,
                    threshold: user.topUpThreshold,
                    monthlyCap: user.monthlyTopUpCap,
                    currentMonthSpend: user.currentMonthTopUpSpend,
                    remainingCap: remainingTopUpCap,
                },
                stripeCustomerId: user.stripeCustomerId,
                stripeSubscriptionId: user.stripeSubscriptionId,
            },
        });
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
                name: user.name,
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
            success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/subscription/canceled`,
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

        res.json({ message: 'Subscription will be canceled at the end of the billing period' });
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
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: false,
        });

        res.json({ message: 'Subscription reactivated' });
    } catch (error) {
        console.error('Reactivate subscription error:', error);
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

        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('STRIPE_WEBHOOK_SECRET not configured');
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

                if (userId && planId && session.subscription) {
                    // Get the plan
                    const [plan] = await db
                        .select()
                        .from(subscriptionPlans)
                        .where(eq(subscriptionPlans.id, planId))
                        .limit(1);

                    if (plan) {
                        const now = new Date();
                        const cycleEnd = new Date(now);
                        cycleEnd.setMonth(cycleEnd.getMonth() + 1);

                        // Update user subscription
                        await db
                            .update(users)
                            .set({
                                subscriptionPlanId: planId,
                                subscriptionStatus: 'active',
                                stripeSubscriptionId: session.subscription as string,
                                billingCycleStart: now,
                                billingCycleEnd: cycleEnd,
                                monthlyCreditsUsed: 0,
                                credits: plan.monthlyCredits,
                                autoTopUpEnabled: plan.allowAutoTopUp,
                                monthlyTopUpCap: plan.defaultMonthlyTopUpCap,
                                topUpThreshold: plan.topUpThreshold,
                                updatedAt: now,
                            })
                            .where(eq(users.id, userId));

                        // Log credit grant
                        await db.insert(creditTransactions).values({
                            userId,
                            amount: plan.monthlyCredits,
                            type: 'monthly_grant',
                            description: `Initial credits from ${plan.name} subscription`,
                            subscriptionPlanId: planId,
                            metadata: {
                                billingCycleStart: now.toISOString(),
                                billingCycleEnd: cycleEnd.toISOString(),
                                stripeSubscriptionId: session.subscription,
                            },
                        });

                        console.log(`Subscription activated for user ${userId}, plan ${plan.name}`);
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                // Find user by Stripe customer ID
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.stripeCustomerId, customerId))
                    .limit(1);

                if (user) {
                    const status = subscription.status as 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'unpaid';
                    await db
                        .update(users)
                        .set({
                            subscriptionStatus: status,
                            updatedAt: new Date(),
                        })
                        .where(eq(users.id, user.id));

                    console.log(`Subscription updated for user ${user.id}, status: ${status}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                // Find user by Stripe customer ID
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.stripeCustomerId, customerId))
                    .limit(1);

                if (user) {
                    await db
                        .update(users)
                        .set({
                            subscriptionStatus: 'canceled',
                            subscriptionPlanId: null,
                            stripeSubscriptionId: null,
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

                // Find user by Stripe customer ID
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.stripeCustomerId, customerId))
                    .limit(1);

                if (user && user.subscriptionPlanId) {
                    // Get the plan
                    const [plan] = await db
                        .select()
                        .from(subscriptionPlans)
                        .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                        .limit(1);

                    if (plan) {
                        const now = new Date();
                        const cycleEnd = new Date(now);
                        cycleEnd.setMonth(cycleEnd.getMonth() + 1);

                        // Reset billing cycle and grant credits
                        await db
                            .update(users)
                            .set({
                                billingCycleStart: now,
                                billingCycleEnd: cycleEnd,
                                monthlyCreditsUsed: 0,
                                credits: plan.monthlyCredits,
                                subscriptionStatus: 'active',
                                updatedAt: now,
                            })
                            .where(eq(users.id, user.id));

                        // Log credit grant
                        await db.insert(creditTransactions).values({
                            userId: user.id,
                            amount: plan.monthlyCredits,
                            type: 'monthly_grant',
                            description: `Monthly credits from ${plan.name} subscription`,
                            subscriptionPlanId: plan.id,
                            metadata: {
                                billingCycleStart: now.toISOString(),
                                billingCycleEnd: cycleEnd.toISOString(),
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

                // Find user by Stripe customer ID
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.stripeCustomerId, customerId))
                    .limit(1);

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
