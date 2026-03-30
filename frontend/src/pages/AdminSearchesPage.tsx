import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminSearch as SearchRecord } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Loader2,
    CheckCircle,
    XCircle,
    Clock,
    Play,
    AlertTriangle,
    Activity,
    TrendingUp,
    TrendingDown,
    Minus,
    AlertCircle
} from 'lucide-react';
import { ErrorDetailsDialog } from '@/components/ErrorDetailsDialog';

interface TimelineData {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
    const config = {
        pending: { icon: Clock, label: 'Pending', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
        running: { icon: Play, label: 'Running', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
        paused: { icon: AlertTriangle, label: 'Paused', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
        completed: { icon: CheckCircle, label: 'Completed', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
        failed: { icon: XCircle, label: 'Failed', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
    };

    const { icon: Icon, label, className } = config[status as keyof typeof config] || config.pending;

    return (
        <Badge variant="outline" className={className}>
            <Icon className="h-3 w-3 mr-1" />
            {label}
        </Badge>
    );
}

function TimelineBar({ data }: { data: TimelineData[] }) {
    const stats = useMemo(() => {
        const completed = data.filter(d => d.status === 'completed').length;
        const failed = data.filter(d => d.status === 'failed').length;
        const running = data.filter(d => d.status === 'running').length;
        const pending = data.filter(d => d.status === 'pending').length;
        const paused = data.filter(d => d.status === 'paused').length;
        const lastFailure = data.find(d => d.status === 'failed');
        return { completed, failed, running, pending, paused, total: data.length, lastFailure };
    }, [data]);

    const visibleItems = data.slice(0, 100);
    const paddedItems = Array.from({ length: 100 }, (_, index) => visibleItems[index] ?? null);

    const getBarColor = (status?: TimelineData['status']) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500';
            case 'failed':
                return 'bg-red-500';
            case 'running':
                return 'bg-amber-500';
            case 'paused':
                return 'bg-slate-500';
            case 'pending':
                return 'bg-yellow-500';
            default:
                return 'bg-slate-300/70 dark:bg-slate-600/70';
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-2">
                <div
                    className="grid h-6 gap-1"
                    style={{ gridTemplateColumns: 'repeat(100, minmax(0, 1fr))' }}
                >
                    {paddedItems.map((item, index) => {
                        const bar = (
                            <div
                                className={`h-full min-w-0 rounded-[2px] transition-opacity hover:opacity-80 ${getBarColor(item?.status)}`}
                            />
                        );

                        if (!item) {
                            return <div key={`empty-${index}`}>{bar}</div>;
                        }

                        return (
                            <Tooltip key={item.id}>
                                <TooltipTrigger asChild>
                                    <div>{bar}</div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="font-medium capitalize">{item.status}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(item.createdAt).toLocaleString()}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>
            </div>
            <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        Completed: {stats.completed}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        Failed: {stats.failed}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Running: {stats.running}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                        Paused: {stats.paused}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                        Pending: {stats.pending}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground md:justify-end">
                    <span>Showing {visibleItems.length} of 100</span>
                    {stats.lastFailure && (
                        <span>
                            Last error: {new Date(stats.lastFailure.createdAt).toLocaleString()}
                        </span>
                    )}
                    <span>Total: {stats.total}</span>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, trend, trendValue }: {
    title: string;
    value: number;
    icon: typeof Activity;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
}) {
    return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <div className="flex items-center gap-2">
                    <p className="text-xl font-bold">{value}</p>
                    {trend && trendValue && (
                        <span className={`text-xs flex items-center gap-0.5 ${
                            trend === 'up' ? 'text-green-600' :
                            trend === 'down' ? 'text-red-600' :
                            'text-muted-foreground'
                        }`}>
                            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> :
                             trend === 'down' ? <TrendingDown className="h-3 w-3" /> :
                             <Minus className="h-3 w-3" />}
                            {trendValue}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function Pagination({ page, totalPages, onPageChange }: {
    page: number;
    totalPages: number;
    onPageChange: (p: number) => void;
}) {
    const pages = useMemo(() => {
        const items: (number | string)[] = [];
        
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) items.push(i);
        } else {
            items.push(1);
            
            if (page > 3) items.push('...');
            
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);
            
            for (let i = start; i <= end; i++) items.push(i);
            
            if (page < totalPages - 2) items.push('...');
            
            items.push(totalPages);
        }
        
        return items;
    }, [page, totalPages]);

    return (
        <div className="flex items-center justify-center gap-1">
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {pages.map((p, i) => (
                typeof p === 'number' ? (
                    <Button
                        key={i}
                        variant={p === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onPageChange(p)}
                        className="w-9"
                    >
                        {p}
                    </Button>
                ) : (
                    <span key={i} className="px-2 text-muted-foreground">...</span>
                )
            ))}
            
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}

export default function AdminSearchesPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'searches', page, statusFilter, debouncedSearch],
        queryFn: () => adminApi.getSearches(page, 20, statusFilter, debouncedSearch),
        refetchInterval: 15000,
    });

    const { data: timelineData, isLoading: timelineLoading } = useQuery({
        queryKey: ['admin', 'searches', 'timeline'],
        queryFn: () => adminApi.getSearchesTimeline(),
        refetchInterval: 15000,
    });

    const filteredSearches = data?.searches;

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Logs</h1>
                        <p className="text-muted-foreground">Monitor all search activities and errors</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-5">
                    <StatCard
                        title="Total Searches"
                        value={timelineData?.stats?.total ?? 0}
                        icon={Activity}
                    />
                    <StatCard
                        title="Completed"
                        value={timelineData?.stats?.completed ?? 0}
                        icon={CheckCircle}
                        trend="up"
                        trendValue={`${Math.round((timelineData?.stats?.completed ?? 0) / Math.max(timelineData?.stats?.total ?? 1, 1) * 100)}%`}
                    />
                    <StatCard
                        title="Failed"
                        value={timelineData?.stats?.failed ?? 0}
                        icon={XCircle}
                        trend={(timelineData?.stats?.failed ?? 0) > 0 ? 'down' : 'neutral'}
                        trendValue={`${Math.round((timelineData?.stats?.failed ?? 0) / Math.max(timelineData?.stats?.total ?? 1, 1) * 100)}%`}
                    />
                    <StatCard
                        title="Running"
                        value={timelineData?.stats?.running ?? 0}
                        icon={Play}
                    />
                    <StatCard
                        title="Paused"
                        value={timelineData?.stats?.paused ?? 0}
                        icon={AlertTriangle}
                    />
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Activity Timeline
                        </CardTitle>
                        <CardDescription>Last 100 searches (auto-refresh every 15s)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {timelineLoading ? (
                            <div className="flex items-center justify-center h-12">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <TimelineBar data={timelineData?.timeline ?? []} />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <CardTitle>Search History</CardTitle>
                                <CardDescription>
                                    {data?.pagination.total ?? 0} total searches
                                </CardDescription>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by query, location or user..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 w-full sm:w-64"
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                                    <SelectTrigger className="w-full sm:w-40">
                                        <SelectValue placeholder="All Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="running">Running</SelectItem>
                                        <SelectItem value="paused">Paused</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Status</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Query</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Location</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">User</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Results</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Credits</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Date</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSearches?.map((search: SearchRecord) => (
                                                <tr key={search.id} className="border-b hover:bg-muted/50 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <StatusBadge status={search.status} />
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="space-y-1">
                                                            <p className="font-medium truncate max-w-[200px]">{search.query}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Limit: {search.requestedMaxResults} • {search.requestEnrichment ? 'Enriched' : 'Standard'}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="space-y-1">
                                                            <p className="text-sm truncate max-w-[150px]">{search.location}</p>
                                                            {search.apifyRunId && (
                                                                <p className="text-xs text-muted-foreground font-mono">
                                                                    Run {search.apifyRunId}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div>
                                                            <p className="font-medium text-sm">{search.user.name}</p>
                                                            <p className="text-xs text-muted-foreground">{search.user.email}</p>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="text-sm">
                                                            <p className="font-medium">{search.totalResults ?? 0}</p>
                                                            {search.enrichedResultsCount ? (
                                                                <p className="text-xs text-muted-foreground">
                                                                    {search.standardResultsCount ?? 0} std / {search.enrichedResultsCount} enriched
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">
                                                                    Requested {search.requestedMaxResults}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="text-sm">
                                                            <p className="font-medium">{search.creditsUsed}</p>
                                                            {search.apifyUsageUsd && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    ${search.apifyUsageUsd} Apify
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="text-sm">
                                                            <p>{new Date(search.createdAt).toLocaleDateString()}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {new Date(search.createdAt).toLocaleTimeString()}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {search.status === 'failed' && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-2"
                                                                onClick={() => {
                                                                    setSelectedSearchId(search.id);
                                                                    setErrorDialogOpen(true);
                                                                }}
                                                            >
                                                                <AlertCircle className="h-4 w-4" />
                                                                View Error
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {filteredSearches?.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>No searches found</p>
                                    </div>
                                )}

                                {data && data.pagination.totalPages > 1 && (
                                    <div className="mt-4 pt-4 border-t">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground">
                                                Page {data.pagination.page} of {data.pagination.totalPages}
                                            </p>
                                            <Pagination
                                                page={page}
                                                totalPages={data.pagination.totalPages}
                                                onPageChange={setPage}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {selectedSearchId && (
                    <ErrorDetailsDialog
                        searchId={selectedSearchId}
                        open={errorDialogOpen}
                        onOpenChange={setErrorDialogOpen}
                    />
                )}
            </div>
        </TooltipProvider>
    );
}
