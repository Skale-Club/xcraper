import {
    createContext,
    useContext,
    useEffect,
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { searchApi, settingsApi, ApiError, type SearchStatus } from '@/lib/api';
import {
    Search,
    MapPin,
    Loader2,
    X,
    ChevronRight,
    Users,
    Mail,
    Compass,
    Check,
    Hash,
} from 'lucide-react';

const MIN_STANDARD_RESULTS = 30;
const MIN_ENRICHED_RESULTS = 15;

function getMinimumResults(requestEnrichment: boolean | null) {
    return requestEnrichment ? MIN_ENRICHED_RESULTS : MIN_STANDARD_RESULTS;
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

    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [maxResults, setMaxResults] = useState(MIN_STANDARD_RESULTS);
    const [requestEnrichment, setRequestEnrichment] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
    const [isSearchSurveyOpen, setIsSearchSurveyOpen] = useState(false);
    const [surveyStep, setSurveyStep] = useState(0);
    const [autocompleteOpen, setAutocompleteOpen] = useState(false);

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

                if (status.status === 'completed' || status.status === 'failed' || status.status === 'paused') {
                    clearInterval(pollInterval);
                    setActiveSearchId(null);
                    setSearchStatus(null);

                    queryClient.invalidateQueries({ queryKey: ['search-history'] });

                    if (status.status === 'completed') {
                        toast({
                            title: 'Search Completed!',
                            description: `Found ${status.totalResults} results, saved ${status.savedResults} contacts.`,
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
                console.error('Error polling status:', error);
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

    const hasDraft = !isSearchSurveyOpen && (
        query.trim() !== '' ||
        location.trim() !== '' ||
        requestEnrichment !== null ||
        surveyStep > 0
    );

    const dismissSearchSurvey = () => {
        if (isLoading) return;
        setIsSearchSurveyOpen(false);
    };

    const cancelSearchSurvey = () => {
        if (isLoading) return;
        setIsSearchSurveyOpen(false);
        setSurveyStep(0);
        setQuery('');
        setLocation('');
        setMaxResults(MIN_STANDARD_RESULTS);
        setRequestEnrichment(null);
    };

    const openSearchSurvey = () => {
        if (activeSearchId) return;
        if (!hasDraft) {
            setQuery('');
            setLocation('');
            setMaxResults(MIN_STANDARD_RESULTS);
            setRequestEnrichment(null);
            setSurveyStep(0);
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
            setMaxResults(MIN_STANDARD_RESULTS);
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

    const creditsPerStandardLead = settingsData?.settings.creditsPerStandardResult ?? 1;
    const creditsPerEnrichedLead = settingsData?.settings.creditsPerEnrichedResult ?? 3;
    const isAdmin = user?.role === 'admin';
    const userCredits = user?.credits ?? 0;
    const creditsPerLead = requestEnrichment ? creditsPerEnrichedLead : creditsPerStandardLead;
    const minimumResults = getMinimumResults(requestEnrichment);
    const maxSelectableResults = isAdmin ? 500 : Math.min(500, Math.floor(userCredits / creditsPerLead));
    const canAffordMinimumSearch = isAdmin || maxSelectableResults >= minimumResults;
    const sliderMax = canAffordMinimumSearch ? maxSelectableResults : minimumResults;
    const totalSurveySteps = 4;
    const canMoveForward = surveyStep === 0
        ? requestEnrichment !== null
        : surveyStep === 1
            ? Boolean(query.trim())
            : surveyStep === 2
                ? Boolean(location.trim())
                : canAffordMinimumSearch && maxResults >= minimumResults && maxResults <= sliderMax;

    useEffect(() => {
        if (requestEnrichment === null) return;

        setMaxResults((current) => Math.max(current, getMinimumResults(requestEnrichment)));
    }, [requestEnrichment]);

    const handleSurveyNext = async () => {
        if (!canMoveForward) {
            toast({
                variant: 'destructive',
                title: 'Missing answer',
                description: surveyStep === 0
                    ? 'Choose your lead type before continuing.'
                    : surveyStep === 1
                        ? 'Enter what you want to search for.'
                        : surveyStep === 2
                            ? 'Enter the location to search in.'
                            : canAffordMinimumSearch
                                ? `Choose a result limit between ${minimumResults} and ${sliderMax}.`
                                : `You need at least ${minimumResults * creditsPerLead} credits to run this search.`,
            });
            return;
        }

        if (surveyStep === totalSurveySteps - 1) {
            await handleSearch();
            return;
        }

        setAutocompleteOpen(false);
        setSurveyStep((current) => current + 1);
    };

    const handleLeadTypeSelect = (needsEmail: boolean) => {
        if (isLoading) return;
        setRequestEnrichment(needsEmail);
        setMaxResults(getMinimumResults(needsEmail));
        setSurveyStep(1);
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
                                        {surveyStep === 0 && (
                                            <motion.div
                                                key="email-mode-step"
                                                initial={{ opacity: 0, x: 18 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -18 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <div className="mb-5">
                                                    <h2 id="search-survey-title" className="text-xl font-semibold tracking-tight text-foreground">
                                                        Choose lead type
                                                    </h2>
                                                    <p className="mt-1.5 text-sm text-muted-foreground">
                                                        Select the type of data you want to collect from Google Maps.
                                                    </p>
                                                </div>

                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLeadTypeSelect(false)}
                                                        className={`group relative rounded-2xl border-2 px-5 py-5 text-left transition-all duration-200 ${
                                                            requestEnrichment === false
                                                                ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                                                                : 'border-border bg-background hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm'
                                                        }`}
                                                    >
                                                        {requestEnrichment === false && (
                                                            <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                                                <Check className="h-3 w-3 text-primary-foreground" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-3">
                                                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
                                                                requestEnrichment === false
                                                                    ? 'bg-primary/15 text-primary'
                                                                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                                                            }`}>
                                                                <Users className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-base font-semibold text-foreground">All Leads</p>
                                                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                                                    Business name, phone number, address, website, ratings and all available data.
                                                                </p>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className="w-fit rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                                                            >
                                                                {creditsPerStandardLead} credit{creditsPerStandardLead === 1 ? '' : 's'}/result
                                                            </Badge>
                                                        </div>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleLeadTypeSelect(true)}
                                                        className={`group relative rounded-2xl border-2 px-5 py-5 text-left transition-all duration-200 ${
                                                            requestEnrichment === true
                                                                ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                                                                : 'border-border bg-background hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm'
                                                        }`}
                                                    >
                                                        {requestEnrichment === true && (
                                                            <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                                                <Check className="h-3 w-3 text-primary-foreground" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-3">
                                                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${
                                                                requestEnrichment === true
                                                                    ? 'bg-primary/15 text-primary'
                                                                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                                                            }`}>
                                                                <Mail className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-base font-semibold text-foreground">+ Email</p>
                                                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                                                    We try to find a public business email. Not guaranteed.
                                                                </p>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className="w-fit rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                                                            >
                                                                {creditsPerEnrichedLead} credit{creditsPerEnrichedLead === 1 ? '' : 's'}/result
                                                            </Badge>
                                                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                                                                Why more expensive? We try to find contact details, but some results will not include an email.
                                                            </p>
                                                        </div>
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

                                        {surveyStep === 2 && (
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

                                        {surveyStep === 3 && (
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
                                                        Choose the maximum number of businesses to process for this search.
                                                        {requestEnrichment
                                                            ? ` Minimum ${MIN_ENRICHED_RESULTS} results per enriched run.`
                                                            : ` Minimum ${MIN_STANDARD_RESULTS} results per standard run.`}
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
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>{minimumResults}</span>
                                                        {sliderMax >= 50 && minimumResults < 50 && <span>50</span>}
                                                        {sliderMax >= 100 && minimumResults < 100 && <span>100</span>}
                                                        {sliderMax >= 200 && minimumResults < 200 && <span>200</span>}
                                                        {sliderMax >= 300 && minimumResults < 300 && <span>300</span>}
                                                        {sliderMax >= 400 && minimumResults < 400 && <span>400</span>}
                                                        <span>{sliderMax}</span>
                                                    </div>
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
                                                                {requestEnrichment ? (
                                                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                                                ) : (
                                                                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <span className="text-foreground">
                                                                {requestEnrichment
                                                                    ? `+ Email (${creditsPerEnrichedLead} credits/result)`
                                                                    : `All Leads (${creditsPerStandardLead} credit${creditsPerStandardLead === 1 ? '' : 's'}/result)`}
                                                            </span>
                                                        </div>
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
