import { db } from '../db/index.js';
import { users, subscriptionPlans } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface CapInfo {
    defaultCap: number;
    userCap: number | null;
    effectiveCap: number;
    spent: number;
    remaining: number;
    percentageUsed: number;
    capOverride: string | null;
}

export interface CapStatus {
    withinCap: boolean;
    currentSpend: number;
    capLimit: number;
    remaining: number;
    percentageUsed: number;
}

class SpendingCapService {
    async getEffectiveCap(userId: string): Promise<CapInfo> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        let defaultCap = 20.00;

        if (user.subscriptionPlanId) {
            const [plan] = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .limit(1);

            if (plan) {
                defaultCap = parseFloat(plan.defaultMonthlyTopUpCap ?? '20.00');
            }
        }

        const userCap = user.capOverride ? parseFloat(user.capOverride) : null;
        const effectiveCap = userCap ?? parseFloat(user.monthlyTopUpCap ?? defaultCap.toString());
        const spent = parseFloat(user.currentMonthTopUpSpend ?? '0');
        const remaining = Math.max(0, effectiveCap - spent);
        const percentageUsed = effectiveCap > 0 ? (spent / effectiveCap) * 100 : 0;

        return {
            defaultCap,
            userCap,
            effectiveCap,
            spent,
            remaining,
            percentageUsed,
            capOverride: user.capOverride,
        };
    }

    async canTopUp(userId: string, amount: number): Promise<boolean> {
        const capStatus = await this.getCapStatus(userId);
        return capStatus.remaining >= amount;
    }

    async recordSpending(userId: string, amount: number): Promise<void> {
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
                currentMonthTopUpSpend: newSpend.toString(),
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
    }

    async getCapStatus(userId: string): Promise<CapStatus> {
        const capInfo = await this.getEffectiveCap(userId);

        return {
            withinCap: capInfo.remaining > 0,
            currentSpend: capInfo.spent,
            capLimit: capInfo.effectiveCap,
            remaining: capInfo.remaining,
            percentageUsed: capInfo.percentageUsed,
        };
    }

    async setCapOverride(userId: string, cap: number, adminId?: string): Promise<void> {
        await db
            .update(users)
            .set({
                capOverride: cap.toString(),
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        console.log(`Cap override set for user ${userId}: $${cap}${adminId ? ` by admin ${adminId}` : ''}`);
    }

    async removeCapOverride(userId: string): Promise<void> {
        await db
            .update(users)
            .set({
                capOverride: null,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
    }

    async getUsersAtCap(limit: number = 80): Promise<{
        id: string;
        email: string;
        name: string;
        percentageUsed: number;
        currentSpend: number;
        capLimit: number;
    }[]> {
        const allUsers = await db
            .select()
            .from(users)
            .where(eq(users.subscriptionStatus, 'active'));

        const usersAtCap = [];

        for (const user of allUsers) {
            const capStatus = await this.getCapStatus(user.id);
            if (capStatus.percentageUsed >= limit) {
                usersAtCap.push({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    percentageUsed: capStatus.percentageUsed,
                    currentSpend: capStatus.currentSpend,
                    capLimit: capStatus.capLimit,
                });
            }
        }

        return usersAtCap.sort((a, b) => b.percentageUsed - a.percentageUsed);
    }

    async checkAndAlertCapThresholds(userId: string): Promise<{
        shouldAlert80: boolean;
        shouldAlert100: boolean;
        percentageUsed: number;
    }> {
        const capStatus = await this.getCapStatus(userId);

        return {
            shouldAlert80: capStatus.percentageUsed >= 80 && capStatus.percentageUsed < 100,
            shouldAlert100: capStatus.percentageUsed >= 100,
            percentageUsed: capStatus.percentageUsed,
        };
    }
}

export const spendingCapService = new SpendingCapService();
export default spendingCapService;
