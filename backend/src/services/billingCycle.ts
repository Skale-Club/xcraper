import { db } from '../db';
import { users, subscriptionPlans, creditTransactions, billingEvents } from '../db/schema';
import { eq, and, lte } from 'drizzle-orm';

export interface BillingCycleResult {
    success: boolean;
    creditsGranted: number;
    rolloverCredits: number;
    expiredCredits: number;
    newCycleStart: Date;
    newCycleEnd: Date;
}

export interface RolloverResult {
    rolloverAmount: number;
    expiredAmount: number;
}

class BillingCycleService {
    async startNewCycle(userId: string): Promise<BillingCycleResult> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        if (!user.subscriptionPlanId) {
            throw new Error('User has no subscription plan');
        }

        const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
            .limit(1);

        if (!plan) {
            throw new Error('Subscription plan not found');
        }

        const now = new Date();
        const cycleEnd = new Date(now);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);

        let rolloverAmount = 0;
        let expiredAmount = 0;

        if (plan.allowRollover && user.credits > 0) {
            const rolloverResult = await this.processRollover(userId, user.credits, plan);
            rolloverAmount = rolloverResult.rolloverAmount;
            expiredAmount = rolloverResult.expiredAmount;
        }

        await this.resetCycleCounters(userId);

        const updateData: Record<string, unknown> = {
            credits: plan.monthlyCredits,
            billingCycleStart: now,
            billingCycleEnd: cycleEnd,
            monthlyCreditsUsed: 0,
            topUpsThisCycle: 0,
            currentMonthTopUpSpend: '0.00',
            updatedAt: now,
        };

        if (rolloverAmount > 0) {
            updateData.rolloverCredits = rolloverAmount;
        }

        await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId));

        await db.insert(creditTransactions).values({
            userId,
            amount: plan.monthlyCredits,
            type: 'monthly_grant',
            description: `Monthly credits from ${plan.name} plan`,
            subscriptionPlanId: plan.id,
            metadata: {
                billingCycleStart: now.toISOString(),
                billingCycleEnd: cycleEnd.toISOString(),
            },
        });

        await db.insert(billingEvents).values({
            userId,
            eventType: 'monthly_grant',
            creditDelta: plan.monthlyCredits,
            subscriptionPlanId: plan.id,
            metadata: {
                billingCycleStart: now.toISOString(),
                billingCycleEnd: cycleEnd.toISOString(),
            },
        });

        if (rolloverAmount > 0) {
            await db.insert(billingEvents).values({
                userId,
                eventType: 'rollover',
                creditDelta: rolloverAmount,
                metadata: {
                    source: 'billing_cycle_renewal',
                },
            });
        }

        if (expiredAmount > 0) {
            await db.insert(billingEvents).values({
                userId,
                eventType: 'expiration',
                creditDelta: -expiredAmount,
                metadata: {
                    reason: 'rollover_expiration',
                },
            });
        }

        return {
            success: true,
            creditsGranted: plan.monthlyCredits,
            rolloverCredits: rolloverAmount,
            expiredCredits: expiredAmount,
            newCycleStart: now,
            newCycleEnd: cycleEnd,
        };
    }

    async processRollover(
        userId: string,
        currentCredits: number,
        plan: typeof subscriptionPlans.$inferSelect
    ): Promise<RolloverResult> {
        if (!plan.allowRollover) {
            return { rolloverAmount: 0, expiredAmount: currentCredits };
        }

        let rolloverAmount = currentCredits;

        if (plan.maxRolloverCredits && rolloverAmount > plan.maxRolloverCredits) {
            rolloverAmount = plan.maxRolloverCredits;
        }

        const expiredAmount = currentCredits - rolloverAmount;

        return { rolloverAmount, expiredAmount };
    }

    async expireRolloverCredits(userId: string): Promise<number> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user || user.rolloverCredits <= 0) {
            return 0;
        }

        const [plan] = user.subscriptionPlanId
            ? await db
                  .select()
                  .from(subscriptionPlans)
                  .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                  .limit(1)
            : [null];

        if (plan?.rolloverExpirationDays) {
            const cycleStart = user.billingCycleStart;
            if (cycleStart) {
                const expirationDate = new Date(cycleStart);
                expirationDate.setDate(expirationDate.getDate() + plan.rolloverExpirationDays);
                
                if (new Date() < expirationDate) {
                    return 0;
                }
            }
        }

        const expiredAmount = user.rolloverCredits;

        await db
            .update(users)
            .set({
                rolloverCredits: 0,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        await db.insert(creditTransactions).values({
            userId,
            amount: -expiredAmount,
            type: 'expired',
            description: 'Rollover credits expired',
        });

        await db.insert(billingEvents).values({
            userId,
            eventType: 'expiration',
            creditDelta: -expiredAmount,
            metadata: {
                reason: 'rollover_expiration',
            },
        });

        return expiredAmount;
    }

    async resetCycleCounters(userId: string): Promise<void> {
        await db
            .update(users)
            .set({
                monthlyCreditsUsed: 0,
                topUpsThisCycle: 0,
                currentMonthTopUpSpend: '0.00',
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
    }

    async checkCycleRenewal(userId: string): Promise<boolean> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user || !user.billingCycleEnd) {
            return false;
        }

        return new Date() >= user.billingCycleEnd;
    }

    async grantMonthlyCredits(userId: string, planId: string): Promise<number> {
        const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId))
            .limit(1);

        if (!plan) {
            throw new Error('Plan not found');
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        await db
            .update(users)
            .set({
                credits: plan.monthlyCredits,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        await db.insert(creditTransactions).values({
            userId,
            amount: plan.monthlyCredits,
            type: 'monthly_grant',
            description: `Monthly credits from ${plan.name} plan`,
            subscriptionPlanId: planId,
        });

        await db.insert(billingEvents).values({
            userId,
            eventType: 'monthly_grant',
            creditDelta: plan.monthlyCredits,
            subscriptionPlanId: planId,
        });

        return plan.monthlyCredits;
    }

    async initializeBillingCycle(userId: string, planId: string): Promise<void> {
        const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId))
            .limit(1);

        if (!plan) {
            throw new Error('Plan not found');
        }

        const now = new Date();
        const cycleEnd = new Date(now);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);

        await db
            .update(users)
            .set({
                subscriptionPlanId: planId,
                subscriptionStatus: 'active',
                credits: plan.monthlyCredits,
                billingCycleStart: now,
                billingCycleEnd: cycleEnd,
                monthlyCreditsUsed: 0,
                topUpsThisCycle: 0,
                currentMonthTopUpSpend: '0.00',
                autoTopUpEnabled: plan.allowAutoTopUp,
                monthlyTopUpCap: plan.defaultMonthlyTopUpCap,
                topUpThreshold: plan.topUpThreshold,
                topUpBlockCredits: plan.defaultTopUpCredits,
                topUpBlockPrice: plan.defaultTopUpPrice,
                updatedAt: now,
            })
            .where(eq(users.id, userId));

        await db.insert(creditTransactions).values({
            userId,
            amount: plan.monthlyCredits,
            type: 'monthly_grant',
            description: `Initial credits from ${plan.name} subscription`,
            subscriptionPlanId: planId,
            metadata: {
                billingCycleStart: now.toISOString(),
                billingCycleEnd: cycleEnd.toISOString(),
            },
        });

        await db.insert(billingEvents).values({
            userId,
            eventType: 'monthly_grant',
            creditDelta: plan.monthlyCredits,
            subscriptionPlanId: planId,
            metadata: {
                billingCycleStart: now.toISOString(),
                billingCycleEnd: cycleEnd.toISOString(),
            },
        });
    }

    async processExpiredCycles(): Promise<{ userId: string; renewed: boolean }[]> {
        const now = new Date();
        
        const expiredUsers = await db
            .select()
            .from(users)
            .where(and(
                eq(users.subscriptionStatus, 'active'),
                lte(users.billingCycleEnd, now)
            ));

        const results: { userId: string; renewed: boolean }[] = [];

        for (const user of expiredUsers) {
            try {
                if (user.stripeSubscriptionId) {
                    results.push({ userId: user.id, renewed: false });
                    continue;
                }

                await this.startNewCycle(user.id);
                results.push({ userId: user.id, renewed: true });
            } catch (error) {
                console.error(`Failed to renew cycle for user ${user.id}:`, error);
                results.push({ userId: user.id, renewed: false });
            }
        }

        return results;
    }
}

export const billingCycleService = new BillingCycleService();
export default billingCycleService;
