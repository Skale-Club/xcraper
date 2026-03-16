import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useSearchSurvey } from '@/hooks/useSearchSurvey';
import { searchApi, settingsApi, type SearchHistory } from '@/lib/api';
import {
    Search,
    MapPin,
    Clock,
    Loader2,
    Plus,
    CheckCircle,
    XCircle,
    AlertCircle,
    ChevronRight,
    PauseCircle,
    Trash2,
} from 'lucide-react';

const SEARCH_TIPS = [
    'Grab a coffee, our bots got this',
    'Teaching our robots to read Google Maps',
    'Convincing Google we are not a robot',
    'Our hamsters are running extra fast today',
    'Plot twist: the data is almost ready',
    'Scraping so you don\'t have to',
    'If this were manual, you\'d still be on page 1',
    'Fun fact: you just saved yourself hours of work',
    'Our bots never take lunch breaks',
    'Turning Google Maps into your personal CRM',
    'Meanwhile, your competitors are still googling',
    'Sit tight, magic takes a minute',
    'No robots were harmed in this search',
    'Finding needles in the Google Maps haystack',
    'BRB, collecting business cards at scale',
    'Your future clients don\'t know it yet',
    'Data is loading, greatness is brewing',
    'Almost there, just double-checking everything',
    'Doing the boring stuff so you don\'t have to',
    'This beats cold calling, right?',
];

export default function DashboardPage() {
    const { user } = useAuth();
    const [, setNavLocation] = useLocation();
    const [tipIndex, setTipIndex] = useState(0);
    const {
        activeSearchId,
        searchStatus,
        openSearchSurvey,
        cancelSearchSurvey,
        hasDraft,
        isLoading,
        pauseSearch,
        isPausePending,
        pausePendingSearchId,
    } = useSearchSurvey();

    useEffect(() => {
        if (!activeSearchId) return;
        const interval = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % SEARCH_TIPS.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [activeSearchId]);

    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ['search-history'],
        queryFn: () => searchApi.getHistory(1, 5),
        refetchInterval: (query) => {
            if (activeSearchId) return false;

            const history = query.state.data?.history ?? [];
            return history.some((search) => search.status === 'running' || search.status === 'pending')
                ? 15000
                : false;
        },
        refetchOnWindowFocus: false,
    });

    const { data: settingsData } = useQuery({
        queryKey: ['public-settings'],
        queryFn: () => settingsApi.getPublic(),
    });

    const searchHistory = historyData?.history ?? [];
    const creditsPerStandardLead = settingsData?.settings.creditsPerStandardResult ?? 1;
    const creditsPerEnrichedLead = settingsData?.settings.creditsPerEnrichedResult ?? 3;
    const isAdmin = user?.role === 'admin';
    const getDisplayedSearchCredits = (search: SearchHistory) => {
        if (isAdmin) {
            return 0;
        }

        if (search.creditsUsed > 0) {
            return search.creditsUsed;
        }

        if ((search.status === 'completed' || search.status === 'paused') && (search.savedResults ?? 0) > 0) {
            const searchCreditsPerLead = search.requestEnrichment ? creditsPerEnrichedLead : creditsPerStandardLead;
            return (search.savedResults ?? 0) * searchCreditsPerLead;
        }

        return 0;
    };

    const isSearchActive = (status: string) => status === 'running' || status === 'pending';

    const handlePauseSearch = (searchId: string) => {
        pauseSearch(searchId);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-5 w-5 text-emerald-500" />;
            case 'failed':
                return <XCircle className="h-5 w-5 text-red-500" />;
            case 'running':
                return <Loader2 className="h-5 w-5 animate-spin text-amber-500" />;
            case 'paused':
                return <PauseCircle className="h-5 w-5 text-slate-500" />;
            default:
                return <AlertCircle className="h-5 w-5 text-yellow-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
            case 'failed':
                return 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border-red-200 dark:border-red-500/20';
            case 'running':
                return 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
            case 'paused':
                return 'bg-slate-100 dark:bg-slate-500/10 text-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';
            default:
                return 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20';
        }
    };

    return (
        <div className="w-full space-y-8 pb-10">
            {activeSearchId && searchStatus && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="rounded-full bg-amber-100 dark:bg-amber-500/10 p-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-amber-600 dark:text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-amber-900 dark:text-foreground">
                                        Search in Progress
                                        {searchStatus.itemsCount ? ` — ${searchStatus.itemsCount} results found` : ''}
                                    </p>
                                    <div className="h-5 mt-0.5 overflow-hidden relative">
                                        <AnimatePresence mode="wait">
                                            <motion.p
                                                key={tipIndex}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.4 }}
                                                className="text-sm font-medium text-amber-700 dark:text-muted-foreground absolute"
                                            >
                                                {SEARCH_TIPS[tipIndex]}
                                                <span className="inline-flex w-6 ml-0.5">
                                                    <span className="animate-[dotPulse_1.4s_infinite] [animation-delay:0s]">.</span>
                                                    <span className="animate-[dotPulse_1.4s_infinite] [animation-delay:0.2s]">.</span>
                                                    <span className="animate-[dotPulse_1.4s_infinite] [animation-delay:0.4s]">.</span>
                                                </span>
                                            </motion.p>
                                        </AnimatePresence>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-200 bg-background/80 text-amber-900 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/10"
                                    onClick={() => handlePauseSearch(activeSearchId)}
                                    disabled={isPausePending}
                                >
                                    {isPausePending && pausePendingSearchId === activeSearchId ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <PauseCircle className="mr-2 h-4 w-4" />
                                    )}
                                    Pause
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Column: Search CTA */}
                <motion.div
                    className="w-full lg:w-80 shrink-0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="relative">
                        <button
                            type="button"
                            onClick={openSearchSurvey}
                            disabled={isLoading || !!activeSearchId}
                            className="group relative flex h-[285px] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-blue-200/80 bg-gradient-to-br from-blue-50 via-card to-card text-foreground shadow-sm transition duration-200 ease-in-out hover:scale-[1.04] hover:-rotate-1 hover:shadow-md dark:border-blue-500/20 dark:from-blue-500/10 dark:via-card dark:to-card disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {hasDraft && (
                                <div className="absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Draft saved
                                </div>
                            )}

                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsla(217,91%,60%,0.18),transparent_45%),linear-gradient(180deg,hsla(217,91%,60%,0.06),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,hsla(217,91%,60%,0.22),transparent_45%),linear-gradient(180deg,hsla(217,91%,60%,0.08),transparent_65%)]" />

                            <div className="absolute left-1/2 top-[calc(50%-42px)] z-10 -translate-x-1/2 transition duration-200 ease-in-out group-hover:top-1/2 group-hover:-translate-y-1/2">
                                {isLoading ? (
                                    <Loader2 className="h-10 w-10 animate-spin text-primary transition duration-200 ease-in-out group-hover:h-40 group-hover:w-40 group-hover:blur-[6px] group-hover:opacity-[0.15]" />
                                ) : (
                                    <Plus className="h-10 w-10 text-primary transition duration-200 ease-in-out group-hover:h-40 group-hover:w-40 group-hover:blur-[6px] group-hover:opacity-[0.15] group-hover:[animation:float-card_3s_ease-in-out_infinite]" />
                                )}
                            </div>

                            <div className="relative z-10 flex flex-col items-center justify-center gap-3 pt-16 transition duration-200 ease-in-out group-hover:opacity-0">
                                <p className="text-2xl font-semibold tracking-tight text-foreground">
                                    {isLoading ? 'Starting...' : hasDraft ? 'Continue Search' : 'New Search'}
                                </p>
                            </div>

                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-8 text-center opacity-0 transition duration-200 ease-in-out group-hover:opacity-100">
                                <p className="text-2xl font-semibold tracking-tight text-foreground">
                                    {hasDraft ? 'Continue Search' : 'New Search'}
                                </p>
                                <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                                    {hasDraft
                                        ? 'Pick up where you left off and finish setting up your search.'
                                        : 'Launch our guided search to find and export your ideal contacts in seconds.'}
                                </p>
                            </div>
                        </button>

                        {hasDraft && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    cancelSearchSurvey();
                                }}
                                className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-destructive/30 hover:text-destructive"
                            >
                                <Trash2 className="h-3 w-3" />
                                Discard draft
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* Right Column: Recent Searches */}
                <motion.div
                    className="flex-1 min-w-0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card className="min-h-[285px] shadow-sm bg-card text-card-foreground rounded-[28px] border border-blue-200/80 dark:border-blue-500/20 overflow-hidden">
                        <CardHeader className="border-b border-border bg-muted/30 pb-4 rounded-t-[28px]">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-foreground">
                                    <div className="rounded-md bg-muted p-2 text-muted-foreground">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    Recent Searches
                                </CardTitle>
                                {searchHistory.length > 0 && (
                                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/10" onClick={() => setNavLocation('/searches')}>
                                        View All
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : searchHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                                    <div className="rounded-full bg-muted p-4 mb-4">
                                        <Search className="h-10 w-10 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium text-foreground">No searches yet</h3>
                                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                        Your recent scraping tasks will appear here. Start your first search from the guided popup to see the results.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {searchHistory.map((search: SearchHistory) => (
                                        <div
                                            key={search.id}
                                            className="group flex cursor-pointer items-start gap-3 px-4 py-3.5 sm:px-5 sm:py-4 sm:items-center transition-colors hover:bg-muted/40"
                                            onClick={() => setNavLocation(`/searches?searchId=${search.id}`)}
                                        >
                                            {isSearchActive(search.status) ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handlePauseSearch(search.id);
                                                    }}
                                                    disabled={isPausePending}
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 transition-colors hover:border-primary/20 hover:bg-primary/5 disabled:opacity-50"
                                                >
                                                    {isPausePending && pausePendingSearchId === search.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    ) : (
                                                        getStatusIcon(search.status)
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 transition-colors group-hover:border-primary/20 group-hover:bg-primary/5">
                                                    {getStatusIcon(search.status)}
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1 space-y-2">
                                                <div>
                                                    <p className="truncate text-sm font-semibold text-foreground capitalize">{search.query}</p>
                                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                                                            <MapPin className="h-3 w-3 shrink-0" />
                                                            <span className="truncate">{search.location}</span>
                                                        </span>
                                                        <span className="opacity-40 hidden xs:inline">·</span>
                                                        <span className="shrink-0">{new Date(search.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 text-xs text-muted-foreground sm:hidden">
                                                    <div className="flex items-center gap-1">
                                                        <span className="tabular-nums text-sm font-semibold text-foreground">{search.totalResults ?? 0}</span>
                                                        <span>results</span>
                                                    </div>
                                                    {!isAdmin && (
                                                        <>
                                                            <span className="opacity-40">·</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="tabular-nums text-sm font-semibold text-foreground">{getDisplayedSearchCredits(search)}</span>
                                                                <span>credits</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="hidden sm:flex items-center gap-8 text-xs text-muted-foreground">
                                                <div className="text-center min-w-[60px]">
                                                    <p className="tabular-nums text-sm font-semibold text-foreground">{search.totalResults ?? 0}</p>
                                                    <p className="text-xs">results</p>
                                                </div>
                                                {!isAdmin && (
                                                    <div className="text-center min-w-[60px]">
                                                        <p className="tabular-nums text-sm font-semibold text-foreground">{getDisplayedSearchCredits(search)}</p>
                                                        <p className="text-xs">credits</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap min-w-[90px] ${getStatusColor(search.status)}`}>
                                                    {search.status.charAt(0).toUpperCase() + search.status.slice(1)}
                                                </span>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground/50 hidden sm:block" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
