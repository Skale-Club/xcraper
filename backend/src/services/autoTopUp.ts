import { db } from '../db';
import { users, subscriptionPlans, creditTransactions, billingEvents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from './stripe';

export interface TopUpResult {
    success: boolean;
    creditsAdded?: number;
    amountCharged?: number;
    error?: string;
    reason?: string;
}

export interface TopUpValidation {
    allowed: boolean;
    reason?: string;
    autoTopUpEnabled?: boolean;
    planAllowsTopUp?: boolean;
    withinCap?: boolean;
    currentSpend?: number;
    capLimit?: number;
}

class AutoTopUpService {
    async checkAndTrigger(userId: string): Promise<TopUpResult> {
        const validation = await this.validateTopUp(userId);

        if (!validation.allowed) {
            return {
                success: false,
                reason: validation.reason,
            };
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const threshold = user.topUpThreshold ?? 50;
        const currentBalance = user.credits + user.rolloverCredits + user.purchasedCredits;

        if (currentBalance > threshold) {
            return {
                success: false,
                reason: 'Above threshold - no top-up needed',
            };
        }

        return this.executeTopUp(userId);
    }

    async executeTopUp(userId: string): Promise<TopUpResult> {
        const validation = await this.validateTopUp(userId);

        if (!validation.allowed) {
            return {
                success: false,
                reason: validation.reason,
            };
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        if (!user.stripeCustomerId) {
            return {
                success: false,
                error: 'No payment method on file',
                reason: 'no_payment_method',
            };
        }

        const topUpCredits = user.topUpBlockCredits ?? 250;
        const topUpPrice = parseFloat(user.topUpBlockPrice ?? '5.90');

        const capStatus = await this.checkCap(userId);
        if (!capStatus.withinCap || capStatus.remaining < topUpPrice) {
            return {
                success: false,
                reason: 'Monthly top-up cap reached',
            };
        }

        if (!stripe) {
            return {
                success: false,
                error: 'Payment system not configured',
            };
        }

        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(topUpPrice * 100),
                currency: 'usd',
                customer: user.stripeCustomerId,
                metadata: {
                    userId,
                    credits: topUpCredits.toString(),
                    type: 'auto_top_up',
                },
                confirm: true,
                off_session: true,
            });

            if (paymentIntent.status !== 'succeeded') {
                return {
                    success: false,
                    error: 'Payment not completed',
                    reason: 'payment_failed',
                };
            }

            await this.recordTopUp(userId, topUpCredits, topUpPrice, paymentIntent.id);

            return {
                success: true,
                creditsAdded: topUpCredits,
                amountCharged: topUpPrice,
            };
        } catch (error) {
            console.error('Auto top-up payment failed:', error);
            
            await db.insert(billingEvents).values({
                userId,
                eventType: 'top_up',
                creditDelta: 0,
                moneyAmount: topUpPrice.toString(),
                metadata: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    credits: topUpCredits,
                },
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Payment failed',
                reason: 'payment_failed',
            };
        }
    }

    async validateTopUp(userId: string): Promise<TopUpValidation> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return { allowed: false, reason: 'User not found' };
        }

        if (!user.autoTopUpEnabled) {
            return {
                allowed: false,
                reason: 'Auto top-up is disabled',
                autoTopUpEnabled: false,
            };
        }

        if (user.accountRiskFlag === 'suspended' || user.accountRiskFlag === 'restricted') {
            return {
                allowed: false,
                reason: 'Account is restricted',
            };
        }

        if (!user.subscriptionPlanId) {
            return {
                allowed: false,
                reason: 'No active subscription',
            };
        }

        const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
            .limit(1);

        if (!plan || !plan.allowAutoTopUp) {
            return {
                allowed: false,
                reason: 'Plan does not support auto top-up',
                planAllowsTopUp: false,
            };
        }

        if (user.subscriptionStatus !== 'active') {
            return {
                allowed: false,
                reason: 'Subscription is not active',
            };
        }

        const capStatus = await this.checkCap(userId);

        return {
            allowed: capStatus.withinCap,
            reason: capStatus.withinCap ? undefined : 'Monthly cap reached',
            withinCap: capStatus.withinCap,
            currentSpend: capStatus.currentSpend,
            capLimit: capStatus.capLimit,
        };
    }

    async checkCap(userId: string): Promise<{
        withinCap: boolean;
        currentSpend: number;
        capLimit: number;
        remaining: number;
    }> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return {
                withinCap: false,
                currentSpend: 0,
                capLimit: 0,
                remaining: 0,
            };
        }

        const currentSpend = parseFloat(user.currentMonthTopUpSpend ?? '0');
        const capLimit = user.capOverride
            ? parseFloat(user.capOverride)
            : parseFloat(user.monthlyTopUpCap ?? '20.00');

        const remaining = Math.max(0, capLimit - currentSpend);
        const withinCap = currentSpend < capLimit;

        return {
            withinCap,
            currentSpend,
            capLimit,
            remaining,
        };
    }

    async recordTopUp(
        userId: string,
        credits: number,
        amount: number,
        paymentIntentId: string
    ): Promise<void> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) return;

        const newSpend = parseFloat(user.currentMonthTopUpSpend ?? '0') + amount;

        await db
            .update(users)
            .set({
                purchasedCredits: user.purchasedCredits + credits,
                currentMonthTopUpSpend: newSpend.toString(),
                topUpsThisCycle: user.topUpsThisCycle + 1,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        await db.insert(creditTransactions).values({
            userId,
            amount: credits,
            type: 'top_up',
            description: `Auto top-up: ${credits} credits for $${amount.toFixed(2)}`,
            moneyAmount: amount.toString(),
            stripePaymentIntentId: paymentIntentId,
        });

        await db.insert(billingEvents).values({
            userId,
            eventType: 'top_up',
            creditDelta: credits,
            moneyAmount: amount.toString(),
            stripePaymentIntentId: paymentIntentId,
            metadata: {
                source: 'auto_top_up',
                topUpBlockCredits: credits,
                topUpBlockPrice: amount.toString(),
            },
        });
    }

    async manualTopUp(
        userId: string,
        credits: number,
        amount: number,
        paymentIntentId: string,
        adminId?: string
    ): Promise<TopUpResult> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const newSpend = parseFloat(user.currentMonthTopUpSpend ?? '0') + amount;

        await db
            .update(users)
            .set({
                purchasedCredits: user.purchasedCredits + credits,
                currentMonthTopUpSpend: newSpend.toString(),
                topUpsThisCycle: user.topUpsThisCycle + 1,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        await db.insert(creditTransactions).values({
            userId,
            amount: credits,
            type: 'purchase',
            description: `Manual purchase: ${credits} credits for $${amount.toFixed(2)}`,
            moneyAmount: amount.toString(),
            stripePaymentIntentId: paymentIntentId,
        });

        await db.insert(billingEvents).values({
            userId,
            eventType: 'purchase',
            creditDelta: credits,
            moneyAmount: amount.toString(),
            stripePaymentIntentId: paymentIntentId,
            adminId,
            metadata: {
                source: adminId ? 'admin_manual' : 'manual_purchase',
            },
        });

        return {
            success: true,
            creditsAdded: credits,
            amountCharged: amount,
        };
    }

    async getTopUpSettings(userId: string): Promise<{
        enabled: boolean;
        threshold: number;
        blockCredits: number;
        blockPrice: string;
        monthlyCap: string;
        currentSpend: string;
        remainingCap: number;
    }> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        const currentSpend = parseFloat(user.currentMonthTopUpSpend ?? '0');
        const cap = user.capOverride
            ? parseFloat(user.capOverride)
            : parseFloat(user.monthlyTopUpCap ?? '20.00');
        const remainingCap = Math.max(0, cap - currentSpend);

        return {
            enabled: user.autoTopUpEnabled,
            threshold: user.topUpThreshold ?? 50,
            blockCredits: user.topUpBlockCredits ?? 250,
            blockPrice: user.topUpBlockPrice ?? '5.90',
            monthlyCap: user.monthlyTopUpCap ?? '20.00',
            currentSpend: user.currentMonthTopUpSpend ?? '0.00',
            remainingCap,
        };
    }

    async updateTopUpSettings(
        userId: string,
        settings: {
            enabled?: boolean;
            threshold?: number;
            blockCredits?: number;
            blockPrice?: string;
            monthlyCap?: string;
        }
    ): Promise<void> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        if (settings.enabled !== undefined && user.subscriptionPlanId) {
            const [plan] = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .limit(1);

            if (plan && !plan.allowAutoTopUp && settings.enabled) {
                throw new Error('Your plan does not support auto top-up');
            }
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() };

        if (settings.enabled !== undefined) updateData.autoTopUpEnabled = settings.enabled;
        if (settings.threshold !== undefined) updateData.topUpThreshold = settings.threshold;
        if (settings.blockCredits !== undefined) updateData.topUpBlockCredits = settings.blockCredits;
        if (settings.blockPrice !== undefined) updateData.topUpBlockPrice = settings.blockPrice;
        if (settings.monthlyCap !== undefined) updateData.monthlyTopUpCap = settings.monthlyCap;

        await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId));
    }
}

export const autoTopUpService = new AutoTopUpService();
export default autoTopUpService;
