import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Users,
    Search,
    Contact,
    Coins,
    TrendingUp,
    UserPlus,
    Activity,
    DollarSign
} from 'lucide-react';

function StatCard({
    title,
    value,
    description,
    icon: Icon,
    loading
}: {
    title: string;
    value: number | string;
    description?: string;
    icon: React.ElementType;
    loading?: boolean;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        {description && (
                            <p className="text-xs text-muted-foreground">{description}</p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default function AdminDashboardPage() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: adminApi.getStats,
    });

    return (
        <div className="space-y-6">
            {/* Main Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Users"
                    value={stats?.totalUsers ?? 0}
                    description="All registered users"
                    icon={Users}
                    loading={isLoading}
                />
                <StatCard
                    title="Total Searches"
                    value={stats?.totalSearches ?? 0}
                    description="Searches performed"
                    icon={Search}
                    loading={isLoading}
                />
                <StatCard
                    title="Total Contacts"
                    value={stats?.totalContacts ?? 0}
                    description="Contacts saved"
                    icon={Contact}
                    loading={isLoading}
                />
                <StatCard
                    title="Credits Distributed"
                    value={stats?.totalCreditsDistributed ?? 0}
                    description="Total credits in user accounts"
                    icon={Coins}
                    loading={isLoading}
                />
            </div>

            {/* Secondary Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Recent Signups"
                    value={stats?.recentSignups ?? 0}
                    description="Last 7 days"
                    icon={UserPlus}
                    loading={isLoading}
                />
                <StatCard
                    title="Recent Searches"
                    value={stats?.recentSearches ?? 0}
                    description="Last 7 days"
                    icon={Activity}
                    loading={isLoading}
                />
                <StatCard
                    title="Credits Purchased"
                    value={stats?.totalPurchasedCredits ?? 0}
                    description="Total purchased credits"
                    icon={DollarSign}
                    loading={isLoading}
                />
                <StatCard
                    title="Credits Used"
                    value={stats?.totalUsedCredits ?? 0}
                    description="Total consumed credits"
                    icon={TrendingUp}
                    loading={isLoading}
                />
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common administrative tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <a
                            href="/admin/users"
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                            <Users className="h-4 w-4" />
                            <span>Manage Users</span>
                        </a>
                        <a
                            href="/admin/contacts"
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                            <Contact className="h-4 w-4" />
                            <span>View All Contacts</span>
                        </a>
                        <a
                            href="/admin/transactions"
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                            <DollarSign className="h-4 w-4" />
                            <span>View Transactions</span>
                        </a>
                        <a
                            href="/admin/settings"
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                            <Activity className="h-4 w-4" />
                            <span>Platform Settings</span>
                        </a>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Platform Health</CardTitle>
                        <CardDescription>System status overview</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Database</span>
                                <span className="flex items-center gap-1 text-sm text-green-600">
                                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                    Healthy
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">API Server</span>
                                <span className="flex items-center gap-1 text-sm text-green-600">
                                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                    Running
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Auth Service</span>
                                <span className="flex items-center gap-1 text-sm text-green-600">
                                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                    Active
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
