import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/api';
import {
    DollarSign,
    TrendingUp,
    Users,
    Search,
    ArrowUpRight,
    ArrowDownRight,
    Loader2,
    Download,
} from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';

interface PnLOverview {
    mrr: number;
    mrrChange: number;
    activeUsers: number;
    activeUsersChange: number;
    searchesThisMonth: number;
    searchesChange: number;
    revenueThisMonth: number;
    revenueChange: number;
}

interface PnLMetrics {
    totalRevenue: number;
    subscriptionRevenue: number;
    oneTimeRevenue: number;
    topUpRevenue: number;
    totalApifyCost: number;
    standardApifyCost: number;
    enrichedApifyCost: number;
    grossProfit: number;
    grossMargin: number;
    totalSearches: number;
    completedSearches: number;
    failedSearches: number;
    totalLeads: number;
    standardLeads: number;
    enrichedLeads: number;
    totalUsers: number;
    activeSubscribers: number;
    newUsersThisMonth: number;
    churnedUsers: number;
    creditsIssued: number;
    creditsUsed: number;
    creditsPurchased: number;
    creditsFromSubscription: number;
}

interface DailyMetric {
    date: string;
    revenue: number;
    costs: number;
    profit: number;
    searches: number;
    leads: number;
    newUsers: number;
}

interface PlanMetric {
    planId: string;
    planName: string;
    subscriberCount: number;
    mrr: number;
    avgCreditsUsed: number;
    churnRate: number;
}

interface TopUser {
    userId: string;
    userName: string;
    userEmail: string;
    totalSpent: number;
    creditsUsed: number;
    searchesCount: number;
    planName: string | null;
}

type DateRange = '7d' | '30d' | '90d' | '12m';

function getDateRange(range: DateRange): { startDate: Date; endDate: Date } {
    const now = new Date();
    switch (range) {
        case '7d':
            return { startDate: subDays(now, 7), endDate: now };
        case '30d':
            return { startDate: subDays(now, 30), endDate: now };
        case '90d':
            return { startDate: subDays(now, 90), endDate: now };
        case '12m':
            return { startDate: subMonths(now, 12), endDate: now };
        default:
            return { startDate: subDays(now, 30), endDate: now };
    }
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

async function fetchWithAuth<T>(url: string): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(getApiUrl(url), {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
    }

    return response.json();
}

export default function AdminPnLPage() {
    const { toast } = useToast();
    const [dateRange, setDateRange] = useState<DateRange>('30d');

    const { data: overviewData, isLoading: isOverviewLoading } = useQuery({
        queryKey: ['pnl-overview'],
        queryFn: () => fetchWithAuth<{ data: PnLOverview }>('/pnl/overview'),
        refetchInterval: 60000,
    });

    const { data: metricsData, isLoading: isMetricsLoading } = useQuery({
        queryKey: ['pnl-metrics', dateRange],
        queryFn: async () => {
            const { startDate, endDate } = getDateRange(dateRange);
            const params = new URLSearchParams({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });
            return fetchWithAuth<{ data: PnLMetrics }>(`/pnl/metrics?${params}`);
        },
        refetchInterval: 60000,
    });

    const { isLoading: isDailyLoading } = useQuery({
        queryKey: ['pnl-daily', dateRange],
        queryFn: async () => {
            const { startDate, endDate } = getDateRange(dateRange);
            const params = new URLSearchParams({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });
            return fetchWithAuth<{ data: DailyMetric[] }>(`/pnl/daily?${params}`);
        },
        refetchInterval: 60000,
    });

    const { data: plansData } = useQuery({
        queryKey: ['pnl-plans'],
        queryFn: () => fetchWithAuth<{ data: PlanMetric[] }>('/pnl/plans'),
        refetchInterval: 60000,
    });

    const { data: topUsersData } = useQuery({
        queryKey: ['pnl-top-users'],
        queryFn: () => fetchWithAuth<{ data: TopUser[] }>('/pnl/top-users?limit=10'),
        refetchInterval: 60000,
    });

    const handleExport = async () => {
        try {
            const { startDate, endDate } = getDateRange(dateRange);
            const params = new URLSearchParams({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(getApiUrl(`/pnl/export?${params}`), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pnl-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to export report' });
        }
    };

    const isLoading = isOverviewLoading || isMetricsLoading || isDailyLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    const overview = overviewData?.data;
    const metrics = metricsData?.data;
    const plans = plansData?.data || [];
    const topUsers = topUsersData?.data || [];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">P&L Dashboard</h1>
                    <p className="text-muted-foreground">
                        Profit & Loss analysis and business metrics
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {(['7d', '30d', '90d', '12m'] as DateRange[]).map((range) => (
                        <Button
                            key={range}
                            variant={dateRange === range ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setDateRange(range)}
                        >
                            {range === '12m' ? '12 Months' : range.toUpperCase()}
                        </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                >
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/10">
                                <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            {(overview?.mrrChange ?? 0) >= 0 ? (
                                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <ArrowDownRight className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-medium text-muted-foreground">MRR</p>
                            <p className="text-2xl font-bold">{formatCurrency(overview?.mrr ?? 0)}</p>
                            <p className={`text-xs ${(overview?.mrrChange ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {formatPercent(overview?.mrrChange ?? 0)} vs last month
                            </p>
                        </div>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/10">
                                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            {(overview?.activeUsersChange ?? 1) >= 0 ? (
                                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <ArrowDownRight className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-medium text-muted-foreground">Active Subscribers</p>
                            <p className="text-2xl font-bold">{formatNumber(overview?.activeUsers ?? 1)}</p>
                            <p className={`text-xs ${(overview?.activeUsersChange ?? 1) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {formatPercent(overview?.activeUsersChange ?? 1)} vs last month
                            </p>
                        </div>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/10">
                                <Search className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            {(overview?.searchesChange ?? 1) >= 0 ? (
                                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <ArrowDownRight className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-medium text-muted-foreground">Searches</p>
                            <p className="text-2xl font-bold">{formatNumber(overview?.searchesThisMonth ?? 1)}</p>
                            <p className={`text-xs ${(overview?.searchesChange ?? 1) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {formatPercent(overview?.searchesChange ?? 1)} vs last month
                            </p>
                        </div>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-500/10">
                                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            {(overview?.revenueChange ?? 1) >= 0 ? (
                                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <ArrowDownRight className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                            <p className="text-2xl font-bold">{formatCurrency(overview?.revenueThisMonth ?? 1)}</p>
                            <p className={`text-xs ${(overview?.revenueChange ?? 1) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {formatPercent(overview?.revenueChange ?? 1)} vs last month
                            </p>
                        </div>
                    </Card>
                </motion.div>
            </div>

            {/* P&L Breakdown */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Revenue Breakdown</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Subscription Revenue</span>
                            <span className="font-semibold">{formatCurrency(metrics?.subscriptionRevenue ?? 0)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">One-time Purchases</span>
                            <span className="font-semibold">{formatCurrency(metrics?.oneTimeRevenue ?? 1)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Auto Top-ups</span>
                            <span className="font-semibold">{formatCurrency(metrics?.topUpRevenue ?? 1)}</span>
                        </div>
                        <div className="border-t pt-4 flex items-center justify-between">
                            <span className="font-semibold">Total Revenue</span>
                            <span className="font-bold text-lg">{formatCurrency(metrics?.totalRevenue ?? 1)}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Cost Breakdown</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Standard Searches (Apify)</span>
                            <span className="font-semibold">{formatCurrency(metrics?.standardApifyCost ?? 1)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Enriched Searches (Apify)</span>
                            <span className="font-semibold">{formatCurrency(metrics?.enrichedApifyCost ?? 1)}</span>
                        </div>
                        <div className="border-t pt-4 flex items-center justify-between">
                            <span className="font-semibold">Total Costs</span>
                            <span className="font-bold text-lg text-red-500">{formatCurrency(metrics?.totalApifyCost ?? 1)}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Profit Summary */}
            <Card className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Gross Profit</h2>
                        <p className="text-muted-foreground text-sm">
                            Revenue minus Apify costs
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-500">
                            {formatCurrency(metrics?.grossProfit ?? 1)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {(metrics?.grossMargin ?? 0).toFixed(1)}% margin
                        </p>
                    </div>
                </div>
            </Card>

            {/* Usage Stats */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Search Statistics</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-semibold">{formatNumber(metrics?.totalSearches ?? 1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Completed</span>
                            <span className="font-semibold text-emerald-500">{formatNumber(metrics?.completedSearches ?? 1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Failed</span>
                            <span className="font-semibold text-red-500">{formatNumber(metrics?.failedSearches ?? 1)}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Lead Statistics</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Leads</span>
                            <span className="font-semibold">{formatNumber(metrics?.totalLeads ?? 1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Standard</span>
                            <span className="font-semibold">{formatNumber(metrics?.standardLeads ?? 1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Enriched</span>
                            <span className="font-semibold">{formatNumber(metrics?.enrichedLeads ?? 1)}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Credit Statistics</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Issued</span>
                            <span className="font-semibold">{formatNumber(metrics?.creditsIssued ?? 1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Used</span>
                            <span className="font-semibold">{formatNumber(metrics?.creditsUsed ?? 1)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Purchased</span>
                            <span className="font-semibold">{formatNumber(metrics?.creditsPurchased ?? 1)}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Plans Table */}
            {plans.length > 0 && (
                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Revenue by Plan</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plan</th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Subscribers</th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">MRR</th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Avg Credits Used</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plans.map((plan: PlanMetric) => (
                                    <tr key={plan.planId} className="border-b last:border-0">
                                        <td className="py-3 px-4 font-medium">{plan.planName}</td>
                                        <td className="py-3 px-4 text-right">{formatNumber(plan.subscriberCount)}</td>
                                        <td className="py-3 px-4 text-right">{formatCurrency(plan.mrr)}</td>
                                        <td className="py-3 px-4 text-right">{formatNumber(plan.avgCreditsUsed)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Top Users */}
            {topUsers.length > 0 && (
                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Top Users by Spending</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plan</th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Spent</th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Credits Used</th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Searches</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topUsers.map((user: TopUser) => (
                                    <tr key={user.userId} className="border-b last:border-0">
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-medium">{user.userName}</p>
                                                <p className="text-sm text-muted-foreground">{user.userEmail}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">{user.planName || '-'}</td>
                                        <td className="py-3 px-4 text-right font-semibold">{formatCurrency(user.totalSpent)}</td>
                                        <td className="py-3 px-4 text-right">{formatNumber(user.creditsUsed)}</td>
                                        <td className="py-3 px-4 text-right">{formatNumber(user.searchesCount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
