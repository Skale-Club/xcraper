import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { searchApi, settingsApi, ApiError, SearchHistory, SearchStatus } from '@/lib/api';
import {
    Search,
    MapPin,
    Clock,
    Loader2,
    Plus,
    CheckCircle,
    XCircle,
    X,
    AlertCircle,
    ChevronRight,
} from 'lucide-react';

export default function DashboardPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [maxResults, setMaxResults] = useState(50);
    const [requestEnrichment, setRequestEnrichment] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
    const [isSearchSurveyOpen, setIsSearchSurveyOpen] = useState(false);
    const [surveyStep, setSurveyStep] = useState(0);

    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ['search-history'],
        queryFn: () => searchApi.getHistory(1, 5),
    });

    const { data: settingsData } = useQuery({
        queryKey: ['public-settings'],
        queryFn: () => settingsApi.getPublic(),
    });

    useEffect(() => {
        if (!activeSearchId) return;

        const pollInterval = setInterval(async () => {
            try {
                const status = await searchApi.getStatus(activeSearchId);
                setSearchStatus(status);

                if (status.status === 'completed' || status.status === 'failed') {
                    clearInterval(pollInterval);
                    setActiveSearchId(null);
                    setSearchStatus(null);

                    queryClient.invalidateQueries({ queryKey: ['search-history'] });

                    if (status.status === 'completed') {
                        toast({
                            title: 'Search Completed!',
                            description: `Found ${status.totalResults} results, saved ${status.savedResults} contacts.`,
                        });
                    } else {
                        toast({
                            variant: 'destructive',
                            title: 'Search Failed',
                            description: 'The scraping task failed. Please try again.',
                        });
                    }
                }
            } catch (error) {
                console.error('Error polling status:', error);
            }
        }, 3000);

        return () => clearInterval(pollInterval);
    }, [activeSearchId, queryClient, toast]);

    const closeSearchSurvey = () => {
        if (isLoading) return;
        setIsSearchSurveyOpen(false);
        setSurveyStep(0);
    };

    useEffect(() => {
        if (!isSearchSurveyOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isLoading) {
                setIsSearchSurveyOpen(false);
                setSurveyStep(0);
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSearchSurveyOpen, isLoading]);

    const openSearchSurvey = () => {
        if (activeSearchId) return;
        setQuery('');
        setLocation('');
        setMaxResults(50);
        setRequestEnrichment(null);
        setSurveyStep(0);
        setIsSearchSurveyOpen(true);
    };

    const handleSearch = async () => {
        if (requestEnrichment === null || !query.trim() || !location.trim()) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Complete every search step before starting.',
            });
            return;
        }

        setIsLoading(true);
        try {
            const response = await searchApi.start(query, location, maxResults, requestEnrichment);
            setActiveSearchId(response.searchId);
            setSearchStatus({ status: 'running' });

            queryClient.invalidateQueries({ queryKey: ['search-history'] });

            toast({
                title: 'Search Started',
                description: 'Your scraping task has been initiated...',
            });

            setIsSearchSurveyOpen(false);
            setSurveyStep(0);
            setQuery('');
            setLocation('');
            setMaxResults(50);
            setRequestEnrichment(null);
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to start search';
            toast({
                variant: 'destructive',
                title: 'Error',
                description: message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const searchHistory = historyData?.history ?? [];
    const creditsPerStandardLead = settingsData?.settings.creditsPerStandardResult ?? 1;
    const creditsPerEnrichedLead = settingsData?.settings.creditsPerEnrichedResult ?? 3;
    const totalSurveySteps = 4;
    const canMoveForward = surveyStep === 0
        ? requestEnrichment !== null
        : surveyStep === 1
            ? Boolean(query.trim())
            : surveyStep === 2
                ? Boolean(location.trim())
                : maxResults >= 1 && maxResults <= 500;

    const handleSurveyNext = async () => {
        if (!canMoveForward) {
            toast({
                variant: 'destructive',
                title: 'Missing answer',
                description: surveyStep === 0
                    ? 'Choose whether you want leads with email or not.'
                    : surveyStep === 1
                        ? 'Enter what you want to search for.'
                        : surveyStep === 2
                            ? 'Enter the location to search in.'
                            : 'Choose a result limit between 1 and 500.',
            });
            return;
        }

        if (surveyStep === totalSurveySteps - 1) {
            await handleSearch();
            return;
        }

        setSurveyStep((current) => current + 1);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-5 w-5 text-emerald-500" />;
            case 'failed':
                return <XCircle className="h-5 w-5 text-red-500" />;
            case 'running':
                return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
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
                return 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
            default:
                return 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20';
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-10">
            {activeSearchId && searchStatus && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="rounded-full bg-blue-100 dark:bg-blue-500/10 p-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-blue-900 dark:text-foreground">Search in Progress</p>
                                    <p className="text-sm font-medium text-blue-700 dark:text-muted-foreground mt-0.5">
                                        {searchStatus.itemsCount
                                            ? `Found ${searchStatus.itemsCount} results so far...`
                                            : 'Starting the scraping task...'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Left Column: Search CTA */}
                <motion.div
                    className="lg:col-span-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <button
                        type="button"
                        onClick={openSearchSurvey}
                        disabled={isLoading || !!activeSearchId}
                        className="group relative flex h-[285px] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-blue-200/80 bg-gradient-to-br from-blue-50 via-card to-card text-foreground shadow-sm transition duration-200 ease-in-out hover:scale-[1.04] hover:-rotate-1 hover:shadow-md dark:border-blue-500/20 dark:from-blue-500/10 dark:via-card dark:to-card disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsla(217,91%,60%,0.18),transparent_45%),linear-gradient(180deg,hsla(217,91%,60%,0.06),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,hsla(217,91%,60%,0.22),transparent_45%),linear-gradient(180deg,hsla(217,91%,60%,0.08),transparent_65%)]" />

                        <div className="absolute left-1/2 top-[calc(50%-42px)] z-10 -translate-x-1/2 transition duration-200 ease-in-out group-hover:top-1/2 group-hover:-translate-y-1/2">
                            {isLoading ? (
                                <Loader2 className="h-10 w-10 animate-spin text-primary transition duration-200 ease-in-out group-hover:h-40 group-hover:w-40 group-hover:blur-[6px]" />
                            ) : (
                                <Plus className="h-10 w-10 text-primary transition duration-200 ease-in-out group-hover:h-40 group-hover:w-40 group-hover:blur-[6px] group-hover:[animation:float-card_3s_ease-in-out_infinite]" />
                            )}
                        </div>

                        <div className="relative z-10 flex flex-col items-center justify-center gap-3 pt-16 transition duration-200 ease-in-out group-hover:opacity-0">
                            <p className="text-2xl font-semibold tracking-tight text-foreground">
                                {isLoading ? 'Starting...' : 'New Search'}
                            </p>
                        </div>

                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-8 text-center opacity-0 transition duration-200 ease-in-out group-hover:opacity-100">
                            <p className="text-2xl font-semibold tracking-tight text-foreground">New Search</p>
                            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                                Open the guided popup and answer three quick questions, one at a time.
                            </p>
                            <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
                                1 credit + 1 per saved contact
                            </p>
                        </div>
                    </button>
                </motion.div>

                {/* Right Column: Recent Searches */}
                <motion.div
                    className="lg:col-span-2 flex flex-col"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card className="flex-1 shadow-sm bg-card text-card-foreground">
                        <CardHeader className="border-b border-border bg-muted/30 pb-4 rounded-t-xl">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-foreground">
                                    <div className="rounded-md bg-muted p-2 text-muted-foreground">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    Recent Searches
                                </CardTitle>
                                {searchHistory.length > 0 && (
                                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/10">
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
                                <div className="flex flex-col items-center justify-center py-16 text-center">
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
                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-5 transition-colors hover:bg-muted/50 gap-4 sm:gap-0"
                                        >
                                            <div className="flex items-start sm:items-center gap-4">
                                                <div className="mt-0.5 sm:mt-0">
                                                    {getStatusIcon(search.status)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground">{search.query}</p>
                                                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3.5 w-3.5" />
                                                            {search.location}
                                                        </span>
                                                        <span className="hidden sm:inline opacity-50">•</span>
                                                        <span className="text-xs">
                                                            {new Date(search.createdAt).toLocaleDateString(undefined, { 
                                                                month: 'short', day: 'numeric', year: 'numeric' 
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 ml-9 sm:ml-0">
                                                <div className="flex flex-col items-start sm:items-end">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getStatusColor(search.status)}`}>
                                                        {search.status.charAt(0).toUpperCase() + search.status.slice(1)}
                                                    </span>
                                                    {search.totalResults !== undefined && (
                                                        <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                                                            {search.totalResults} results
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-foreground">
                                                        {search.creditsUsed}
                                                    </p>
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                        Credits
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            <AnimatePresence>
                {isSearchSurveyOpen && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="search-survey-title"
                            initial={{ opacity: 0, y: 24, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-2xl rounded-[28px] border border-border bg-background shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-border px-6 py-5">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                        Guided Search
                                    </p>
                                    <h2 id="search-survey-title" className="mt-2 text-2xl font-semibold text-foreground">
                                        Step {surveyStep + 1} of {totalSurveySteps}
                                    </h2>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={closeSearchSurvey}
                                    disabled={isLoading}
                                    aria-label="Close guided search"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="px-6 pt-5">
                                <div className="flex gap-2">
                                    {Array.from({ length: totalSurveySteps }).map((_, index) => (
                                        <div
                                            key={index}
                                            className={`h-1.5 flex-1 rounded-full ${index <= surveyStep ? 'bg-primary' : 'bg-muted'}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <form
                                onSubmit={async (event) => {
                                    event.preventDefault();
                                    await handleSurveyNext();
                                }}
                                className="px-6 py-6"
                            >
                                <AnimatePresence mode="wait">
                                    {surveyStep === 0 && (
                                        <motion.div
                                            key="email-mode-step"
                                            initial={{ opacity: 0, x: 18 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -18 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <p className="text-3xl font-semibold tracking-tight text-foreground">
                                                    Do you need leads with email?
                                                </p>
                                                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                                    Choose the lead type first. Pricing comes from your admin settings and updates automatically.
                                                </p>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setRequestEnrichment(false)}
                                                    className={`rounded-2xl border p-5 text-left transition ${requestEnrichment === false
                                                        ? 'border-primary bg-primary/10 shadow-sm'
                                                        : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
                                                        }`}
                                                >
                                                    <p className="text-lg font-semibold text-foreground">No email required</p>
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        Save standard leads without filtering for email.
                                                    </p>
                                                    <p className="mt-4 text-sm font-semibold text-primary">
                                                        {creditsPerStandardLead} credit{creditsPerStandardLead === 1 ? '' : 's'} per lead
                                                    </p>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setRequestEnrichment(true)}
                                                    className={`rounded-2xl border p-5 text-left transition ${requestEnrichment === true
                                                        ? 'border-primary bg-primary/10 shadow-sm'
                                                        : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
                                                        }`}
                                                >
                                                    <p className="text-lg font-semibold text-foreground">Yes, only leads with email</p>
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        Filter the search to leads that include a valid email address.
                                                    </p>
                                                    <p className="mt-4 text-sm font-semibold text-primary">
                                                        {creditsPerEnrichedLead} credit{creditsPerEnrichedLead === 1 ? '' : 's'} per lead
                                                    </p>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {surveyStep === 1 && (
                                        <motion.div
                                            key="query-step"
                                            initial={{ opacity: 0, x: 18 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -18 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <p className="text-3xl font-semibold tracking-tight text-foreground">
                                                    What are you looking for?
                                                </p>
                                                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                                    Use the business type or niche you want to scrape, like restaurants, dentists, gyms, or plumbers.
                                                </p>
                                            </div>
                                            <div className="space-y-2.5">
                                                <Label htmlFor="query" className="text-sm font-semibold text-foreground">
                                                    Search term
                                                </Label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input
                                                        id="query"
                                                        type="text"
                                                        autoFocus
                                                        placeholder="e.g., Restaurants, Dentists, Gyms"
                                                        value={query}
                                                        onChange={(event) => setQuery(event.target.value)}
                                                        className="h-12 pl-10 text-base"
                                                        disabled={isLoading}
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {surveyStep === 2 && (
                                        <motion.div
                                            key="location-step"
                                            initial={{ opacity: 0, x: 18 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -18 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <p className="text-3xl font-semibold tracking-tight text-foreground">
                                                    Where should we search?
                                                </p>
                                                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                                    Enter the city, region, or area you want to target.
                                                </p>
                                            </div>
                                            <div className="space-y-2.5">
                                                <Label htmlFor="location" className="text-sm font-semibold text-foreground">
                                                    Location
                                                </Label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input
                                                        id="location"
                                                        type="text"
                                                        autoFocus
                                                        placeholder="e.g., New York, NY"
                                                        value={location}
                                                        onChange={(event) => setLocation(event.target.value)}
                                                        className="h-12 pl-10 text-base"
                                                        disabled={isLoading}
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {surveyStep === 3 && (
                                        <motion.div
                                            key="max-results-step"
                                            initial={{ opacity: 0, x: 18 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -18 }}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <p className="text-3xl font-semibold tracking-tight text-foreground">
                                                    How many results do you want?
                                                </p>
                                                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                                    Choose the maximum number of businesses to process for this search.
                                                </p>
                                            </div>
                                            <div className="space-y-2.5">
                                                <Label htmlFor="maxResults" className="text-sm font-semibold text-foreground">
                                                    Maximum results
                                                </Label>
                                                <Input
                                                    id="maxResults"
                                                    type="number"
                                                    autoFocus
                                                    min={1}
                                                    max={500}
                                                    value={maxResults}
                                                    onChange={(event) => setMaxResults(parseInt(event.target.value, 10) || 0)}
                                                    className="h-12 text-base"
                                                    disabled={isLoading}
                                                />
                                                <p className="text-sm text-muted-foreground">
                                                    Pick a number between 1 and 500.
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                                                <p>
                                                    <span className="font-semibold text-foreground">Lead type:</span>{' '}
                                                    {requestEnrichment === null
                                                        ? 'Not set'
                                                        : requestEnrichment
                                                            ? `With email (${creditsPerEnrichedLead} credits/lead)`
                                                            : `Without email (${creditsPerStandardLead} credit${creditsPerStandardLead === 1 ? '' : 's'}/lead)`}
                                                </p>
                                                <p><span className="font-semibold text-foreground">Search:</span> {query || 'Not set'}</p>
                                                <p className="mt-1"><span className="font-semibold text-foreground">Location:</span> {location || 'Not set'}</p>
                                                <p className="mt-1"><span className="font-semibold text-foreground">Max results:</span> {maxResults || 'Not set'}</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setSurveyStep((current) => Math.max(current - 1, 0))}
                                        disabled={surveyStep === 0 || isLoading}
                                    >
                                        Back
                                    </Button>
                                    <div className="flex flex-col items-stretch gap-3 sm:flex-row">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={closeSearchSurvey}
                                            disabled={isLoading}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={!canMoveForward || isLoading}>
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Starting Search...
                                                </>
                                            ) : surveyStep === totalSurveySteps - 1 ? (
                                                <>
                                                    <Search className="mr-2 h-4 w-4" />
                                                    Start Scraping
                                                </>
                                            ) : (
                                                'Next Question'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
