import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PlacesAutocompleteInput } from '@/components/app/PlacesAutocompleteInput';
import { ScraperFilterFields } from '@/components/app/ScraperFilterFields';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { searchApi, ApiError, type SearchStatus, type ScraperOption, type StartSearchInput } from '@/lib/api';
import {
    Search,
    MapPin,
    Loader2,
    X,
    ChevronRight,
    Users,
    Mail,
    Building2,
    Compass,
    Check,
    Hash,
    SlidersHorizontal,
} from 'lucide-react';

type StepKey = 'scraper' | 'query' | 'location' | 'filters' | 'maxResults';

function scraperIcon(scraper: ScraperOption) {
    if (scraper.source === 'b2b_leads') return Building2;
    return scraper.extractsEmails ? Mail : Users;
}

export interface SearchSurveyContextValue {
    openSearchSurvey: () => void;
    cancelSearchSurvey: () => void;
    hasDraft: boolean;
    isLoading: boolean;
    activeSearchId: string | null;
    searchStatus: SearchStatus | null;
    pauseSearch: (searchId: string) => void;
    isPausePending: boolean;
    pausePendingSearchId: string | null;
}

const SearchSurveyContext = createContext<SearchSurveyContextValue | null>(null);

export function SearchSurveyProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [filters, setFilters] = useState<Record<string, unknown>>({});
    const [maxResults, setMaxResults] = useState(30);
    const [isLoading, setIsLoading] = useState(false);
    const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
    const [isSearchSurveyOpen, setIsSearchSurveyOpen] = useState(false);
    const [surveyStep, setSurveyStep] = useState(0);
    const [autocompleteOpen, setAutocompleteOpen] = useState(false);

    const { data: scrapersData } = useQuery({
        queryKey: ['scrapers'],
        queryFn: () => searchApi.listScrapers(),
    });
    const scrapers = useMemo(() => scrapersData?.scrapers ?? [], [scrapersData]);
    const selectedScraper = useMemo(
        () => scrapers.find((s) => s.key === selectedKey) ?? null,
        [scrapers, selectedKey],
    );
    const isMaps = selectedScraper?.source === 'google_maps';

    // Dynamic step flow: Maps uses query+location, structured-filter scrapers use a filters step.
    const stepKeys = useMemo<StepKey[]>(() => {
        if (!selectedScraper) return ['scraper'];
        return selectedScraper.source === 'google_maps'
            ? ['scraper', 'query', 'location', 'maxResults']
            : ['scraper', 'filters', 'maxResults'];
    }, [selectedScraper]);
    const totalSurveySteps = stepKeys.length;
    const currentStepKey = stepKeys[Math.min(surveyStep, stepKeys.length - 1)];

    useEffect(() => {
        if (!activeSearchId) return;

        let consecutiveFailures = 0;
        const MAX_FAILURES = 3;

        const pollInterval = setInterval(async () => {
            try {
                const status = await searchApi.getStatus(activeSearchId);
                consecutiveFailures = 0;
                setSearchStatus(status);

                if (status.status === 'completed' || status.status === 'failed' || status.status === 'paused') {
                    clearInterval(pollInterval);
                    setActiveSearchId(null);
                    setSearchStatus(null);

                    queryClient.invalidateQueries({ queryKey: ['search-history'] });

                    if (status.status === 'completed') {
                        toast({
                            title: 'Search Completed!',
                            description: `Found ${status.totalResults ?? 0} results, saved ${status.savedResults ?? 0} contacts.`,
                        });
                    } else if (status.status === 'paused') {
                        toast({
                            title: 'Search Paused',
                            description: 'The scraping task was paused in Apify.',
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
                consecutiveFailures += 1;
                console.error('Error polling status:', error);

                if (consecutiveFailures >= MAX_FAILURES) {
                    clearInterval(pollInterval);
                    setActiveSearchId(null);
                    setSearchStatus(null);
                    queryClient.invalidateQueries({ queryKey: ['search-history'] });
                    toast({
                        variant: 'destructive',
                        title: 'Connection lost',
                        description: 'Unable to track search status. Check your connection or view it in Search History.',
                    });
                }
            }
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [activeSearchId, queryClient, toast]);

    const pauseSearchMutation = useMutation({
        mutationFn: (searchId: string) => searchApi.pause(searchId),
        onSuccess: (_data, searchId) => {
            if (activeSearchId === searchId) {
                setActiveSearchId(null);
                setSearchStatus(null);
            }

            queryClient.invalidateQueries({ queryKey: ['search-history'] });

            toast({
                title: 'Search Paused',
                description: 'The scraping task was paused successfully.',
            });
        },
        onError: (error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to pause search';
            toast({
                variant: 'destructive',
                title: 'Error',
                description: message,
            });
        },
    });

    const resetDraft = () => {
        setSelectedKey(null);
        setQuery('');
        setLocation('');
        setFilters({});
        setMaxResults(30);
        setSurveyStep(0);
    };

    const hasDraft = !isSearchSurveyOpen && (
        selectedKey !== null ||
        query.trim() !== '' ||
        location.trim() !== '' ||
        Object.keys(filters).length > 0 ||
        surveyStep > 0
    );

    const dismissSearchSurvey = () => {
        if (isLoading) return;
        setIsSearchSurveyOpen(false);
    };

    const cancelSearchSurvey = () => {
        if (isLoading) return;
        setIsSearchSurveyOpen(false);
        resetDraft();
    };

    const openSearchSurvey = () => {
        if (activeSearchId) return;
        if (!hasDraft) {
            resetDraft();
        }
        setIsSearchSurveyOpen(true);
    };

    useEffect(() => {
        if (!isSearchSurveyOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isLoading) {
                dismissSearchSurvey();
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

    useEffect(() => {
        const handleOpenSearchDialog = () => {
            openSearchSurvey();
        };

        window.addEventListener('openSearchDialog', handleOpenSearchDialog);
        return () => {
            window.removeEventListener('openSearchDialog', handleOpenSearchDialog);
        };
    }, [activeSearchId, hasDraft]);

    const isAdmin = user?.role === 'admin';
    const userCredits = user?.credits ?? 0;
    const creditsPerLead = selectedScraper?.creditsPerResult ?? 1;
    const minimumResults = selectedScraper?.minResults ?? 1;
    const scraperMax = selectedScraper?.maxResults ?? 500;
    const maxSelectableResults = isAdmin ? scraperMax : Math.min(scraperMax, Math.floor(userCredits / creditsPerLead));
    const canAffordMinimumSearch = isAdmin || maxSelectableResults >= minimumResults;
    const sliderMax = canAffordMinimumSearch ? maxSelectableResults : minimumResults;

    const hasAnyFilter = useMemo(() => {
        if (!selectedScraper) return false;
        return selectedScraper.inputSchema.some((f) => {
            const v = filters[f.key];
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'string') return v.trim().length > 0;
            return v != null;
        });
    }, [selectedScraper, filters]);

    const canMoveForward =
        currentStepKey === 'scraper' ? selectedKey !== null
            : currentStepKey === 'query' ? Boolean(query.trim())
                : currentStepKey === 'location' ? Boolean(location.trim())
                    : currentStepKey === 'filters' ? hasAnyFilter
                        : canAffordMinimumSearch && maxResults >= minimumResults && maxResults <= sliderMax;

    const handleSearch = async () => {
        if (!selectedScraper) return;
        if (isMaps && (!query.trim() || !location.trim())) {
            toast({ variant: 'destructive', title: 'Error', description: 'Complete every search step before starting.' });
            return;
        }
        if (!isMaps && !hasAnyFilter) {
            toast({ variant: 'destructive', title: 'Error', description: 'Add at least one filter before starting.' });
            return;
        }

        setIsLoading(true);
        try {
            const input: StartSearchInput = isMaps
                ? { scrapeType: selectedScraper.key, query, location, maxResults }
                : { scrapeType: selectedScraper.key, filters, maxResults };

            const response = await searchApi.start(input);
            setActiveSearchId(response.searchId);
            setSearchStatus({ status: 'running' });

            queryClient.invalidateQueries({ queryKey: ['search-history'] });

            toast({ title: 'Search Started', description: 'Your scraping task has been initiated...' });

            setIsSearchSurveyOpen(false);
            resetDraft();
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to start search';
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSurveyNext = async () => {
        if (!canMoveForward) {
            const msg =
                currentStepKey === 'scraper' ? 'Choose a scraper before continuing.'
                    : currentStepKey === 'query' ? 'Enter what you want to search for.'
                        : currentStepKey === 'location' ? 'Enter the location to search in.'
                            : currentStepKey === 'filters' ? 'Add at least one filter.'
                                : canAffordMinimumSearch
                                    ? `Choose a result limit between ${minimumResults} and ${sliderMax}.`
                                    : `You need at least ${minimumResults * creditsPerLead} credits to run this search.`;
            toast({ variant: 'destructive', title: 'Missing answer', description: msg });
            return;
        }

        if (surveyStep === totalSurveySteps - 1) {
            await handleSearch();
            return;
        }

        setAutocompleteOpen(false);
        setSurveyStep((current) => current + 1);
    };

    const handleScraperSelect = (scraper: ScraperOption) => {
        if (isLoading) return;
        setSelectedKey(scraper.key);
        // Seed default filter values (e.g. emailStatus = ['validated']).
        const initial: Record<string, unknown> = {};
        scraper.inputSchema.forEach((f) => {
            if (f.defaultValue !== undefined) initial[f.key] = f.defaultValue;
        });
        setFilters(initial);
        setMaxResults(Math.max(scraper.minResults, 0));
        setSurveyStep(1);
    };

    const updateFilter = (key: string, value: unknown) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const contextValue: SearchSurveyContextValue = {
        openSearchSurvey,
        cancelSearchSurvey,
        hasDraft,
        isLoading,
        activeSearchId,
        searchStatus,
        pauseSearch: (searchId: string) => {
            pauseSearchMutation.mutate(searchId);
        },
        isPausePending: pauseSearchMutation.isPending,
        pausePendingSearchId: pauseSearchMutation.variables ?? null,
    };

    return (
        <SearchSurveyContext.Provider value={contextValue}>
            {children}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isSearchSurveyOpen && (
                        <motion.div
                            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-6 backdrop-blur-sm sm:items-center sm:p-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={dismissSearchSurvey}
                        >
                            <motion.div
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="search-survey-title"
                                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 24, scale: 0.96 }}
                                transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
                                className="flex w-full max-w-2xl flex-col overflow-visible rounded-[28px] border border-border bg-background shadow-2xl"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="rounded-t-[28px] border-b border-border bg-muted/20 px-6 py-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                                <Compass className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <p className="text-sm font-semibold text-foreground">
                                                    Guided Search
                                                </p>
                                                <span className="text-xs text-muted-foreground">
                                                    Step {surveyStep + 1} of {totalSurveySteps}
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                            onClick={dismissSearchSurvey}
                                            disabled={isLoading}
                                            aria-label="Close guided search"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex gap-1.5">
                                        {Array.from({ length: totalSurveySteps }).map((_, index) => (
                                            <div
                                                key={index}
                                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                                    index < surveyStep
                                                        ? 'bg-primary'
                                                        : index === surveyStep
                                                            ? 'bg-primary/70'
                                                            : 'bg-muted'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <form
                                    onSubmit={async (event) => {
                                        event.preventDefault();
                                        await handleSurveyNext();
                                    }}
                                    className="overflow-visible px-6 py-6"
                                >
                                    <AnimatePresence mode="wait">
                                        {currentStepKey === 'scraper' && (
                                            <motion.div
                                                key="scraper-step"
                                                initial={{ opacity: 0, x: 18 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -18 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <div className="mb-5">
                                                    <h2 id="search-survey-title" className="text-xl font-semibold tracking-tight text-foreground">
                                                        Choose a data source
                                                    </h2>
                                                    <p className="mt-1.5 text-sm text-muted-foreground">
                                                        Pick the scraper that matches the leads you want to collect.
                                                    </p>
                                                </div>

                                                {scrapers.length === 0 ? (
                                                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-10 text-sm text-muted-foreground">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Loading scrapers...
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        {scrapers.map((scraper) => {
                                                            const Icon = scraperIcon(scraper);
                                                            const selected = selectedKey === scraper.key;
                                                            return (
                                                                <button
                                                                    key={scraper.key}
                                                                    type="button"
                                                                    onClick={() => handleScraperSelect(scraper)}
                                                                    className={`group relative rounded-2xl border-2 px-5 py-5 text-left transition-all duration-200 ${
                                                                        selected
                                                                            ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                                                                            : 'border-border bg-background hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm'
                                                                    }`}
                                                                >
                                                                    {selected && (
                                                                        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                                                            <Check className="h-3 w-3 text-primary-foreground" />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex flex-col gap-3">
                                                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
                                                                            selected
                                                                                ? 'bg-primary/15 text-primary'
                                                                                : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                                                                        }`}>
                                                                            <Icon className="h-5 w-5" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-base font-semibold text-foreground">{scraper.label}</p>
                                                                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                                                                {scraper.description}
                                                                            </p>
                                                                        </div>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="w-fit rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                                                                        >
                                                                            {scraper.creditsPerResult} credit{scraper.creditsPerResult === 1 ? '' : 's'}/result
                                                                        </Badge>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}

                                        {currentStepKey === 'query' && (
                                            <motion.div
                                                key="query-step"
                                                initial={{ opacity: 0, x: 18 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -18 }}
                                                transition={{ duration: 0.2 }}
                                                className={`space-y-6 overflow-visible transition-[padding] duration-200 ${autocompleteOpen ? 'pb-64' : ''}`}
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                                                        What are you looking for?
                                                    </h2>
                                                    <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                                        Enter the business type or niche you want to scrape, like restaurants, dentists, gyms, or plumbers.
                                                    </p>
                                                </div>
                                                <div className="space-y-2.5">
                                                    <Label htmlFor="query" className="text-sm font-semibold text-foreground">
                                                        Search term
                                                    </Label>
                                                    <PlacesAutocompleteInput
                                                        id="query"
                                                        mode="query"
                                                        autoFocus
                                                        placeholder="e.g., Restaurants, Dentists, Gyms"
                                                        value={query}
                                                        onValueChange={setQuery}
                                                        icon={Search}
                                                        disabled={isLoading}
                                                        onOpenChange={setAutocompleteOpen}
                                                    />
                                                </div>
                                            </motion.div>
                                        )}

                                        {currentStepKey === 'location' && (
                                            <motion.div
                                                key="location-step"
                                                initial={{ opacity: 0, x: 18 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -18 }}
                                                transition={{ duration: 0.2 }}
                                                className={`space-y-6 overflow-visible transition-[padding] duration-200 ${autocompleteOpen ? 'pb-64' : ''}`}
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                                                        Where should we search?
                                                    </h2>
                                                    <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                                        Enter the city, region, or area you want to target.
                                                    </p>
                                                </div>
                                                <div className="space-y-2.5">
                                                    <Label htmlFor="location" className="text-sm font-semibold text-foreground">
                                                        Location
                                                    </Label>
                                                    <PlacesAutocompleteInput
                                                        id="location"
                                                        mode="location"
                                                        autoFocus
                                                        placeholder="e.g., New York, NY"
                                                        value={location}
                                                        onValueChange={setLocation}
                                                        icon={MapPin}
                                                        disabled={isLoading}
                                                        onOpenChange={setAutocompleteOpen}
                                                    />
                                                </div>
                                            </motion.div>
                                        )}

                                        {currentStepKey === 'filters' && selectedScraper && (
                                            <motion.div
                                                key="filters-step"
                                                initial={{ opacity: 0, x: 18 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -18 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-6"
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                                                        Who are you targeting?
                                                    </h2>
                                                    <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                                        Add filters to narrow your leads. Start broad, then refine — at least one filter is required.
                                                    </p>
                                                </div>
                                                <ScraperFilterFields
                                                    schema={selectedScraper.inputSchema}
                                                    values={filters}
                                                    onChange={updateFilter}
                                                    disabled={isLoading}
                                                />
                                            </motion.div>
                                        )}

                                        {currentStepKey === 'maxResults' && (
                                            <motion.div
                                                key="max-results-step"
                                                initial={{ opacity: 0, x: 18 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -18 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-6"
                                            >
                                                <div className="space-y-2">
                                                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                                                        How many results do you want?
                                                    </h2>
                                                    <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                                                        Choose the maximum number of leads to process for this search.
                                                        {` Minimum ${minimumResults} results per run.`}
                                                    </p>
                                                </div>
                                                <div className="space-y-5">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="maxResults" className="text-sm font-semibold text-foreground">
                                                            Maximum results
                                                        </Label>
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className="text-2xl font-bold tabular-nums text-primary">
                                                                {maxResults}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                / {sliderMax} leads
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <input
                                                        id="maxResults"
                                                        type="range"
                                                        min={minimumResults}
                                                        max={sliderMax}
                                                        step={1}
                                                        value={Math.min(Math.max(maxResults, minimumResults), sliderMax)}
                                                        onChange={(event) => setMaxResults(parseInt(event.target.value, 10))}
                                                        disabled={isLoading || !canAffordMinimumSearch}
                                                        className="w-full cursor-pointer appearance-none bg-transparent outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md"
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        {isAdmin ? (
                                                            <>Admin mode: this search is not limited by your credit balance.</>
                                                        ) : !canAffordMinimumSearch ? (
                                                            <>
                                                                You need <span className="font-semibold text-foreground">{minimumResults * creditsPerLead}</span> credits
                                                                {' '}to run the minimum {minimumResults}-lead search.
                                                            </>
                                                        ) : (
                                                            <>
                                                                You have <span className="font-semibold text-foreground">{userCredits}</span> credits
                                                                {' '}({creditsPerLead} credit{creditsPerLead === 1 ? '' : 's'}/result)
                                                            </>
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        Search summary
                                                    </p>
                                                    <div className="space-y-2.5">
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                                <Compass className="h-3.5 w-3.5 text-muted-foreground" />
                                                            </div>
                                                            <span className="text-foreground">
                                                                {selectedScraper?.label} ({creditsPerLead} credit{creditsPerLead === 1 ? '' : 's'}/result)
                                                            </span>
                                                        </div>
                                                        {isMaps ? (
                                                            <>
                                                                <div className="flex items-center gap-3 text-sm">
                                                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    </div>
                                                                    <span className="text-foreground">{query}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-sm">
                                                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    </div>
                                                                    <span className="text-foreground">{location}</span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-3 text-sm">
                                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                                                </div>
                                                                <span className="text-foreground">
                                                                    {selectedScraper?.inputSchema
                                                                        .filter((f) => {
                                                                            const v = filters[f.key];
                                                                            return Array.isArray(v) ? v.length > 0 : !!v;
                                                                        })
                                                                        .map((f) => f.label)
                                                                        .join(', ') || 'No filters'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                                            </div>
                                                            <span className="text-foreground">{maxResults} results max</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                                                        <span className="text-muted-foreground">Estimated cost</span>
                                                        <span className="font-semibold text-foreground">{maxResults * creditsPerLead} credits</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {surveyStep > 0 && (
                                        <div className="mt-8 flex items-center justify-between">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => { setAutocompleteOpen(false); setSurveyStep((current) => Math.max(current - 1, 0)); }}
                                                disabled={isLoading}
                                            >
                                                Back
                                            </Button>
                                            <Button type="submit" disabled={!canMoveForward || isLoading}>
                                                {isLoading ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Starting...
                                                    </>
                                                ) : surveyStep === totalSurveySteps - 1 ? (
                                                    <>
                                                        <Search className="mr-2 h-4 w-4" />
                                                        Start Scraping
                                                    </>
                                                ) : (
                                                    <>
                                                        Continue
                                                        <ChevronRight className="ml-1 h-4 w-4" />
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body,
            )}
        </SearchSurveyContext.Provider>
    );
}

export function useSearchSurvey() {
    const context = useContext(SearchSurveyContext);

    if (!context) {
        throw new Error('useSearchSurvey must be used within a SearchSurveyProvider');
    }

    return context;
}
