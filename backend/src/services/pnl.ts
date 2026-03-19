import { db } from '../db/index.js';
import {
    users,
    searchHistory,
    creditTransactions,
    billingEvents,
    subscriptionPlans,
    usageSummary,
} from '../db/schema.js';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';

export interface PnLMetrics {
    // Revenue
    totalRevenue: number;
    subscriptionRevenue: number;
    oneTimeRevenue: number;
    topUpRevenue: number;

    // Costs
    totalApifyCost: number;
    standardApifyCost: number;
    enrichedApifyCost: number;

    // Profit
    grossProfit: number;
    grossMargin: number;

    // Usage
    totalSearches: number;
    completedSearches: number;
    failedSearches: number;
    totalLeads: number;
    standardLeads: number;
    enrichedLeads: number;

    // Customers
    totalUsers: number;
    activeSubscribers: number;
    newUsersThisMonth: number;
    churnedUsers: number;

    // Credits
    creditsIssued: number;
    creditsUsed: number;
    creditsPurchased: number;
    creditsFromSubscription: number;
}

export interface DailyMetric {
    date: string;
    revenue: number;
    costs: number;
    profit: number;
    searches: number;
    leads: number;
    newUsers: number;
}

export interface PlanMetrics {
    planId: string;
    planName: string;
    subscriberCount: number;
    mrr: number;
    avgCreditsUsed: number;
    churnRate: number;
}

export interface TopUserMetrics {
    userId: string;
    userName: string;
    userEmail: string;
    totalSpent: number;
    creditsUsed: number;
    searchesCount: number;
    planName: string | null;
}

class PnLService {
    /**
     * Get overall P&L metrics for a date range
     */
    async getPnLMetrics(startDate: Date, endDate: Date): Promise<PnLMetrics> {
        // Revenue from billing events
        const revenueEvents = await db
            .select({
                type: billingEvents.eventType,
                total: sql<string>`COALESCE(SUM(${billingEvents.moneyAmount}), 0)`.as('total'),
            })
            .from(billingEvents)
            .where(and(
                gte(billingEvents.createdAt, startDate),
                lte(billingEvents.createdAt, endDate)
            ))
            .groupBy(billingEvents.eventType);

        let subscriptionRevenue = 0;
        let oneTimeRevenue = 0;
        let topUpRevenue = 0;

        revenueEvents.forEach((event) => {
            const amount = parseFloat(event.total) || 0;
            switch (event.type) {
                case 'monthly_grant':
                    subscriptionRevenue += amount;
                    break;
                case 'purchase':
                    oneTimeRevenue += amount;
                    break;
                case 'top_up':
                    topUpRevenue += amount;
                    break;
            }
        });

        const totalRevenue = subscriptionRevenue + oneTimeRevenue + topUpRevenue;

        // Apify costs from search history
        const searchCosts = await db
            .select({
                requestEnrichment: searchHistory.requestEnrichment,
                totalCost: sql<string>`COALESCE(SUM(${searchHistory.apifyUsageUsd}), 0)`.as('total_cost'),
                count: sql<string>`COUNT(*)`.as('count'),
            })
            .from(searchHistory)
            .where(and(
                gte(searchHistory.createdAt, startDate),
                lte(searchHistory.createdAt, endDate),
                eq(searchHistory.status, 'completed')
            ))
            .groupBy(searchHistory.requestEnrichment);

        let standardApifyCost = 0;
        let enrichedApifyCost = 0;

        searchCosts.forEach((row) => {
            const cost = parseFloat(row.totalCost) || 0;
            if (row.requestEnrichment) {
                enrichedApifyCost = cost;
            } else {
                standardApifyCost = cost;
            }
        });

        const totalApifyCost = standardApifyCost + enrichedApifyCost;
        const grossProfit = totalRevenue - totalApifyCost;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        // Search statistics
        const [searchStats] = await db
            .select({
                total: sql<string>`COUNT(*)`.as('total'),
                completed: sql<string>`COUNT(*) FILTER (WHERE ${searchHistory.status} = 'completed')`.as('completed'),
                failed: sql<string>`COUNT(*) FILTER (WHERE ${searchHistory.status} = 'failed')`.as('failed'),
                totalLeads: sql<string>`COALESCE(SUM(${searchHistory.savedResults}), 0)`.as('total_leads'),
                standardLeads: sql<string>`COALESCE(SUM(${searchHistory.standardResultsCount}), 0)`.as('standard_leads'),
                enrichedLeads: sql<string>`COALESCE(SUM(${searchHistory.enrichedResultsCount}), 0)`.as('enriched_leads'),
            })
            .from(searchHistory)
            .where(and(
                gte(searchHistory.createdAt, startDate),
                lte(searchHistory.createdAt, endDate)
            ));

        // User statistics
        const [userStats] = await db
            .select({
                total: sql<string>`COUNT(*)`.as('total'),
                active: sql<string>`COUNT(*) FILTER (WHERE ${users.subscriptionStatus} = 'active')`.as('active'),
                newThisMonth: sql<string>`COUNT(*) FILTER (WHERE ${users.createdAt} >= ${startDate.toISOString()})`.as('new_this_month'),
            })
            .from(users);

        // Credit statistics
        const [creditStats] = await db
            .select({
                issued: sql<string>`COALESCE(SUM(${creditTransactions.amount}) FILTER (WHERE ${creditTransactions.amount} > 0), 0)`.as('issued'),
                used: sql<string>`COALESCE(SUM(ABS(${creditTransactions.amount})) FILTER (WHERE ${creditTransactions.amount} < 0), 0)`.as('used'),
                purchased: sql<string>`COALESCE(SUM(${creditTransactions.amount}) FILTER (WHERE ${creditTransactions.type} = 'purchase'), 0)`.as('purchased'),
                fromSubscription: sql<string>`COALESCE(SUM(${creditTransactions.amount}) FILTER (WHERE ${creditTransactions.type} = 'monthly_grant'), 0)`.as('from_subscription'),
            })
            .from(creditTransactions)
            .where(and(
                gte(creditTransactions.createdAt, startDate),
                lte(creditTransactions.createdAt, endDate)
            ));

        return {
            totalRevenue,
            subscriptionRevenue,
            oneTimeRevenue,
            topUpRevenue,
            totalApifyCost,
            standardApifyCost,
            enrichedApifyCost,
            grossProfit,
            grossMargin,
            totalSearches: parseInt(searchStats?.total || '0'),
            completedSearches: parseInt(searchStats?.completed || '0'),
            failedSearches: parseInt(searchStats?.failed || '0'),
            totalLeads: parseInt(searchStats?.totalLeads || '0'),
            standardLeads: parseInt(searchStats?.standardLeads || '0'),
            enrichedLeads: parseInt(searchStats?.enrichedLeads || '0'),
            totalUsers: parseInt(userStats?.total || '0'),
            activeSubscribers: parseInt(userStats?.active || '0'),
            newUsersThisMonth: parseInt(userStats?.newThisMonth || '0'),
            churnedUsers: 0, // TODO: Calculate from subscription cancellations
            creditsIssued: parseInt(creditStats?.issued || '0'),
            creditsUsed: parseInt(creditStats?.used || '0'),
            creditsPurchased: parseInt(creditStats?.purchased || '0'),
            creditsFromSubscription: parseInt(creditStats?.fromSubscription || '0'),
        };
    }

    /**
     * Get daily metrics for charting
     */
    async getDailyMetrics(startDate: Date, endDate: Date): Promise<DailyMetric[]> {
        const results = await db
            .select({
                date: sql<string>`DATE(${searchHistory.createdAt})`.as('date'),
                searches: sql<string>`COUNT(*)`.as('searches'),
                leads: sql<string>`COALESCE(SUM(${searchHistory.savedResults}), 0)`.as('leads'),
                costs: sql<string>`COALESCE(SUM(${searchHistory.apifyUsageUsd}), 0)`.as('costs'),
            })
            .from(searchHistory)
            .where(and(
                gte(searchHistory.createdAt, startDate),
                lte(searchHistory.createdAt, endDate)
            ))
            .groupBy(sql`DATE(${searchHistory.createdAt})`)
            .orderBy(sql`DATE(${searchHistory.createdAt})`);

        // Get revenue by date
        const revenueByDate = await db
            .select({
                date: sql<string>`DATE(${billingEvents.createdAt})`.as('date'),
                revenue: sql<string>`COALESCE(SUM(${billingEvents.moneyAmount}), 0)`.as('revenue'),
            })
            .from(billingEvents)
            .where(and(
                gte(billingEvents.createdAt, startDate),
                lte(billingEvents.createdAt, endDate),
                sql`${billingEvents.moneyAmount} IS NOT NULL`
            ))
            .groupBy(sql`DATE(${billingEvents.createdAt})`);

        // Get new users by date
        const newUsersByDate = await db
            .select({
                date: sql<string>`DATE(${users.createdAt})`.as('date'),
                count: sql<string>`COUNT(*)`.as('count'),
            })
            .from(users)
            .where(and(
                gte(users.createdAt, startDate),
                lte(users.createdAt, endDate)
            ))
            .groupBy(sql`DATE(${users.createdAt})`);

        // Combine into a map
        const revenueMap = new Map(revenueByDate.map(r => [r.date, parseFloat(r.revenue) || 0]));
        const newUsersMap = new Map(newUsersByDate.map(u => [u.date, parseInt(u.count) || 0]));

        return results.map(row => {
            const date = row.date;
            const costs = parseFloat(row.costs) || 0;
            const revenue = revenueMap.get(date) || 0;

            return {
                date,
                revenue,
                costs,
                profit: revenue - costs,
                searches: parseInt(row.searches) || 0,
                leads: parseInt(row.leads) || 0,
                newUsers: newUsersMap.get(date) || 0,
            };
        });
    }

    /**
     * Get metrics by subscription plan
     */
    async getPlanMetrics(): Promise<PlanMetrics[]> {
        const plans = await db
            .select({
                id: subscriptionPlans.id,
                name: subscriptionPlans.name,
                price: subscriptionPlans.price,
                subscriberCount: sql<string>`COUNT(${users.id})`.as('subscriber_count'),
            })
            .from(subscriptionPlans)
            .leftJoin(users, eq(users.subscriptionPlanId, subscriptionPlans.id))
            .where(eq(subscriptionPlans.isActive, true))
            .groupBy(subscriptionPlans.id);

        return plans.map(plan => ({
            planId: plan.id,
            planName: plan.name,
            subscriberCount: parseInt(plan.subscriberCount) || 0,
            mrr: (parseFloat(plan.price) || 0) * (parseInt(plan.subscriberCount) || 0),
            avgCreditsUsed: 0, // TODO: Calculate from usage
            churnRate: 0, // TODO: Calculate from cancellations
        }));
    }

    /**
     * Get top users by spending
     */
    async getTopUsers(limit: number = 10): Promise<TopUserMetrics[]> {
        const results = await db
            .select({
                userId: users.id,
                userName: users.name,
                userEmail: users.email,
                planName: subscriptionPlans.name,
                totalSpent: sql<string>`
                    COALESCE(
                        (SELECT SUM(money_amount) FROM credit_transactions 
                         WHERE user_id = ${users.id} AND money_amount IS NOT NULL),
                        0
                    )
                `.as('total_spent'),
                creditsUsed: sql<string>`
                    COALESCE(
                        (SELECT SUM(ABS(amount)) FROM credit_transactions 
                         WHERE user_id = ${users.id} AND amount < 0),
                        0
                    )
                `.as('credits_used'),
                searchesCount: sql<string>`
                    (SELECT COUNT(*) FROM search_history WHERE user_id = ${users.id})
                `.as('searches_count'),
            })
            .from(users)
            .leftJoin(subscriptionPlans, eq(users.subscriptionPlanId, subscriptionPlans.id))
            .orderBy(desc(sql`total_spent`))
            .limit(limit);

        return results.map(row => ({
            userId: row.userId,
            userName: row.userName,
            userEmail: row.userEmail,
            totalSpent: parseFloat(row.totalSpent) || 0,
            creditsUsed: parseInt(row.creditsUsed) || 0,
            searchesCount: parseInt(row.searchesCount) || 0,
            planName: row.planName,
        }));
    }

    /**
     * Get current month overview
     */
    async getCurrentMonthOverview(): Promise<{
        mrr: number;
        mrrChange: number;
        activeUsers: number;
        activeUsersChange: number;
        searchesThisMonth: number;
        searchesChange: number;
        revenueThisMonth: number;
        revenueChange: number;
    }> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Current month metrics
        const currentMetrics = await this.getPnLMetrics(startOfMonth, now);

        // Last month metrics for comparison
        const lastMetrics = await this.getPnLMetrics(startOfLastMonth, endOfLastMonth);

        // Calculate MRR from active subscriptions
        const [mrrResult] = await db
            .select({
                mrr: sql<string>`
                    COALESCE(SUM(${subscriptionPlans.price}::numeric), 0)
                `.as('mrr'),
            })
            .from(users)
            .innerJoin(subscriptionPlans, eq(users.subscriptionPlanId, subscriptionPlans.id))
            .where(eq(users.subscriptionStatus, 'active'));

        const mrr = parseFloat(mrrResult?.mrr || '0');

        return {
            mrr,
            mrrChange: 0, // TODO: Calculate from previous month
            activeUsers: currentMetrics.activeSubscribers,
            activeUsersChange: currentMetrics.activeSubscribers - lastMetrics.activeSubscribers,
            searchesThisMonth: currentMetrics.totalSearches,
            searchesChange: currentMetrics.totalSearches - lastMetrics.totalSearches,
            revenueThisMonth: currentMetrics.totalRevenue,
            revenueChange: currentMetrics.totalRevenue - lastMetrics.totalRevenue,
        };
    }
}

export const pnlService = new PnLService();
