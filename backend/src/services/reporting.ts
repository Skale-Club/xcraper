import { db } from '../db/index.js';
import { users, subscriptionPlans, creditTransactions, billingEvents, searchHistory } from '../db/schema.js';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export interface RevenueOverview {
    mrr: number;
    activeSubscribers: number;
    churnedSubscribers: number;
    topUpRevenue: number;
    purchaseRevenue: number;
    totalRevenue: number;
}

export interface UserProfitability {
    userId: string;
    email: string;
    name: string;
    planName: string | null;
    subscriptionRevenue: number;
    topUpRevenue: number;
    purchaseRevenue: number;
    totalRevenue: number;
    creditsGranted: number;
    creditsConsumed: number;
    standardResults: number;
    enrichedResults: number;
    estimatedApifyCost: number;
    grossProfit: number;
    marginPercent: number;
    isProfitable: boolean;
    riskFlag: string;
}

export interface UsageReport {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalResults: number;
    standardResults: number;
    enrichedResults: number;
    creditsConsumed: number;
}

export interface TopUpAnalytics {
    totalTopUps: number;
    totalRevenue: number;
    averageTopUp: number;
    topUpByPlan: { planName: string; count: number; revenue: number }[];
}

class ReportingService {
    async getRevenueOverview(): Promise<RevenueOverview> {
        const activeSubscribers = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(users)
            .where(eq(users.subscriptionStatus, 'active'));

        const churnedSubscribers = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(users)
            .where(eq(users.subscriptionStatus, 'canceled'));

        const plans = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.isActive, true));

        let mrr = 0;
        for (const plan of plans) {
            const [{ count }] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(users)
                .where(and(
                    eq(users.subscriptionPlanId, plan.id),
                    eq(users.subscriptionStatus, 'active')
                ));
            mrr += count * parseFloat(plan.price);
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const topUpTransactions = await db
            .select({
                total: sql<string>`COALESCE(SUM(money_amount), 0)`,
            })
            .from(creditTransactions)
            .where(and(
                eq(creditTransactions.type, 'top_up'),
                gte(creditTransactions.createdAt, startOfMonth)
            ));

        const purchaseTransactions = await db
            .select({
                total: sql<string>`COALESCE(SUM(money_amount), 0)`,
            })
            .from(creditTransactions)
            .where(and(
                eq(creditTransactions.type, 'purchase'),
                gte(creditTransactions.createdAt, startOfMonth)
            ));

        const topUpRevenue = parseFloat(topUpTransactions[0]?.total || '0');
        const purchaseRevenue = parseFloat(purchaseTransactions[0]?.total || '0');

        return {
            mrr,
            activeSubscribers: activeSubscribers[0]?.count || 0,
            churnedSubscribers: churnedSubscribers[0]?.count || 0,
            topUpRevenue,
            purchaseRevenue,
            totalRevenue: mrr + topUpRevenue + purchaseRevenue,
        };
    }

    async getUserProfitability(userId: string): Promise<UserProfitability> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        let planName: string | null = null;
        let subscriptionRevenue = 0;

        if (user.subscriptionPlanId) {
            const [plan] = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .limit(1);
            
            if (plan) {
                planName = plan.name;
                subscriptionRevenue = parseFloat(plan.price);
            }
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const topUpTotal = await db
            .select({
                total: sql<string>`COALESCE(SUM(money_amount), 0)`,
            })
            .from(creditTransactions)
            .where(and(
                eq(creditTransactions.userId, userId),
                eq(creditTransactions.type, 'top_up'),
                gte(creditTransactions.createdAt, startOfMonth)
            ));

        const purchaseTotal = await db
            .select({
                total: sql<string>`COALESCE(SUM(money_amount), 0)`,
            })
            .from(creditTransactions)
            .where(and(
                eq(creditTransactions.userId, userId),
                eq(creditTransactions.type, 'purchase'),
                gte(creditTransactions.createdAt, startOfMonth)
            ));

        const topUpRevenue = parseFloat(topUpTotal[0]?.total || '0');
        const purchaseRevenue = parseFloat(purchaseTotal[0]?.total || '0');
        const totalRevenue = subscriptionRevenue + topUpRevenue + purchaseRevenue;

        const creditGrant = await db
            .select({
                total: sql<number>`COALESCE(SUM(amount), 0)::int`,
            })
            .from(creditTransactions)
            .where(and(
                eq(creditTransactions.userId, userId),
                sql`${creditTransactions.type} IN ('monthly_grant', 'purchase', 'top_up', 'bonus', 'rollover')`,
                gte(creditTransactions.createdAt, startOfMonth)
            ));

        const creditUsage = await db
            .select({
                total: sql<number>`COALESCE(SUM(ABS(amount)), 0)::int`,
            })
            .from(creditTransactions)
            .where(and(
                eq(creditTransactions.userId, userId),
                eq(creditTransactions.type, 'usage'),
                gte(creditTransactions.createdAt, startOfMonth)
            ));

        const searches = await db
            .select({
                standardResults: sql<number>`COALESCE(SUM(standard_results_count), 0)::int`,
                enrichedResults: sql<number>`COALESCE(SUM(enriched_results_count), 0)::int`,
            })
            .from(searchHistory)
            .where(and(
                eq(searchHistory.userId, userId),
                gte(searchHistory.createdAt, startOfMonth)
            ));

        const creditsGranted = creditGrant[0]?.total || 0;
        const creditsConsumed = creditUsage[0]?.total || 0;
        const standardResults = searches[0]?.standardResults || 0;
        const enrichedResults = searches[0]?.enrichedResults || 0;

        const estimatedApifyCost = (standardResults * 0.002) + (enrichedResults * 0.01);
        const infrastructureCost = 1;
        const paymentProcessingCost = totalRevenue * 0.029 + 0.30;
        const totalCost = estimatedApifyCost + infrastructureCost + paymentProcessingCost;
        const grossProfit = totalRevenue - totalCost;
        const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        return {
            userId,
            email: user.email,
            name: user.name,
            planName,
            subscriptionRevenue,
            topUpRevenue,
            purchaseRevenue,
            totalRevenue,
            creditsGranted,
            creditsConsumed,
            standardResults,
            enrichedResults,
            estimatedApifyCost,
            grossProfit,
            marginPercent,
            isProfitable: grossProfit > 0,
            riskFlag: user.accountRiskFlag,
        };
    }

    async getAllProfitability(): Promise<UserProfitability[]> {
        const activeUsers = await db
            .select()
            .from(users)
            .where(eq(users.subscriptionStatus, 'active'));

        const results: UserProfitability[] = [];

        for (const user of activeUsers) {
            try {
                const profitability = await this.getUserProfitability(user.id);
                results.push(profitability);
            } catch (error) {
                console.error(`Failed to get profitability for user ${user.id}:`, error);
            }
        }

        return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }

    async getUsageReport(startDate?: Date, endDate?: Date): Promise<UsageReport> {
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate || new Date();

        const jobs = await db
            .select({
                total: sql<number>`count(*)::int`,
                completed: sql<number>`count(*) FILTER (WHERE status = 'completed')::int`,
                failed: sql<number>`count(*) FILTER (WHERE status = 'failed')::int`,
                totalResults: sql<number>`COALESCE(SUM(total_results), 0)::int`,
                standardResults: sql<number>`COALESCE(SUM(standard_results_count), 0)::int`,
                enrichedResults: sql<number>`COALESCE(SUM(enriched_results_count), 0)::int`,
                creditsUsed: sql<number>`COALESCE(SUM(credits_used), 0)::int`,
            })
            .from(searchHistory)
            .where(and(
                gte(searchHistory.createdAt, start),
                lte(searchHistory.createdAt, end)
            ));

        const result = jobs[0];

        return {
            totalJobs: result?.total || 0,
            completedJobs: result?.completed || 0,
            failedJobs: result?.failed || 0,
            totalResults: result?.totalResults || 0,
            standardResults: result?.standardResults || 0,
            enrichedResults: result?.enrichedResults || 0,
            creditsConsumed: result?.creditsUsed || 0,
        };
    }

    async getTopUpAnalytics(startDate?: Date, endDate?: Date): Promise<TopUpAnalytics> {
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate || new Date();

        const topUps = await db
            .select({
                count: sql<number>`count(*)::int`,
                revenue: sql<string>`COALESCE(SUM(money_amount), 0)`,
            })
            .from(creditTransactions)
            .where(and(
                eq(creditTransactions.type, 'top_up'),
                gte(creditTransactions.createdAt, start),
                lte(creditTransactions.createdAt, end)
            ));

        const totalCount = topUps[0]?.count || 0;
        const totalRevenue = parseFloat(topUps[0]?.revenue || '0');
        const averageTopUp = totalCount > 0 ? totalRevenue / totalCount : 0;

        const plans = await db
            .select()
            .from(subscriptionPlans);

        const topUpByPlan: { planName: string; count: number; revenue: number }[] = [];

        for (const plan of plans) {
            const planTopUps = await db
                .select({
                    count: sql<number>`count(*)::int`,
                    revenue: sql<string>`COALESCE(SUM(${creditTransactions.moneyAmount}), 0)`,
                })
                .from(creditTransactions)
                .innerJoin(users, eq(creditTransactions.userId, users.id))
                .where(and(
                    eq(creditTransactions.type, 'top_up'),
                    eq(users.subscriptionPlanId, plan.id),
                    gte(creditTransactions.createdAt, start),
                    lte(creditTransactions.createdAt, end)
                ));

            const count = planTopUps[0]?.count || 0;
            const revenue = parseFloat(planTopUps[0]?.revenue || '0');

            if (count > 0) {
                topUpByPlan.push({
                    planName: plan.name,
                    count,
                    revenue,
                });
            }
        }

        return {
            totalTopUps: totalCount,
            totalRevenue,
            averageTopUp,
            topUpByPlan,
        };
    }

    async getFailedPayments(): Promise<{
        userId: string;
        email: string;
        name: string;
        subscriptionStatus: string;
        lastPaymentAttempt: Date | null;
    }[]> {
        const failedUsers = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                subscriptionStatus: users.subscriptionStatus,
            })
            .from(users)
            .where(eq(users.subscriptionStatus, 'past_due'));

        return failedUsers.map(user => ({
            userId: user.id,
            email: user.email,
            name: user.name,
            subscriptionStatus: user.subscriptionStatus || 'unknown',
            lastPaymentAttempt: null,
        }));
    }

    async getAtRiskUsers(): Promise<{
        userId: string;
        email: string;
        name: string;
        riskType: string;
        details: string;
    }[]> {
        const atRiskUsers: {
            userId: string;
            email: string;
            name: string;
            riskType: string;
            details: string;
        }[] = [];

        const zeroCreditUsers = await db
            .select()
            .from(users)
            .where(and(
                eq(users.subscriptionStatus, 'active'),
                sql`${users.credits} + ${users.rolloverCredits} + ${users.purchasedCredits} = 0`
            ));

        for (const user of zeroCreditUsers) {
            atRiskUsers.push({
                userId: user.id,
                email: user.email,
                name: user.name,
                riskType: 'no_credits',
                details: 'User has zero credits',
            });
        }

        const flaggedUsers = await db
            .select()
            .from(users)
            .where(sql`${users.accountRiskFlag} IN ('review', 'restricted')`);

        for (const user of flaggedUsers) {
            atRiskUsers.push({
                userId: user.id,
                email: user.email,
                name: user.name,
                riskType: user.accountRiskFlag,
                details: `Account flagged as ${user.accountRiskFlag}`,
            });
        }

        return atRiskUsers;
    }

    async getMRRTrend(months: number = 12): Promise<{
        month: string;
        mrr: number;
        subscribers: number;
    }[]> {
        const trend: { month: string; mrr: number; subscribers: number }[] = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

            const monthStr = monthDate.toISOString().slice(0, 7);

            const activeUsers = await db
                .select({
                    planId: users.subscriptionPlanId,
                })
                .from(users)
                .where(and(
                    eq(users.subscriptionStatus, 'active'),
                    lte(users.billingCycleStart, monthEnd)
                ));

            const plans = await db.select().from(subscriptionPlans);
            const planPrices = new Map(plans.map(p => [p.id, parseFloat(p.price)]));

            let mrr = 0;
            for (const user of activeUsers) {
                if (user.planId) {
                    mrr += planPrices.get(user.planId) || 0;
                }
            }

            trend.push({
                month: monthStr,
                mrr,
                subscribers: activeUsers.length,
            });
        }

        return trend;
    }
}

export const reportingService = new ReportingService();
export default reportingService;
