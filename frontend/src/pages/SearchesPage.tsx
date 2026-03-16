import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { searchApi, contactsApi, settingsApi, ApiError, type SearchHistory, type SearchResultsSortBy, type SortDirection } from '@/lib/api';
import {
    Search,
    Star,
    Download,
    Phone,
    Mail,
    MapPin,
    Globe,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Clock,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    PlayCircle,
    PauseCircle,
    Map,
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
    ArrowUpDown,
    Archive,
    ArchiveRestore,
} from 'lucide-react';
import { format } from 'date-fns';
import { ContactsMapDialog } from '@/components/ContactsMapDialog';

export default function SearchesPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [, setLocation] = useLocation();
    const requestedSearchId = new URLSearchParams(window.location.search).get('searchId');

    // State for Search History view vs Contact View
    const [selectedSearch, setSelectedSearch] = useState<SearchHistory | null>(null);
    const [historyPage, setHistoryPage] = useState(1);
    const [contactsPage, setContactsPage] = useState(1);
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [sortBy, setSortBy] = useState<SearchResultsSortBy | undefined>(undefined);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    // Query for Search History
    const { data: historyData, isLoading: isHistoryLoading } = useQuery({
        queryKey: ['search-history', historyPage],
        queryFn: () => searchApi.getHistory(historyPage, 10),
        refetchInterval: (query) => {
            const history = query.state.data?.history ?? [];
            return history.some((search) => search.status === 'running' || search.status === 'pending')
                ? 15000
                : false;
        },
        refetchOnWindowFocus: false,
        enabled: !selectedSearch,
    });

    const { data: requestedSearchData } = useQuery({
        queryKey: ['search-by-id', requestedSearchId],
        queryFn: () => searchApi.get(requestedSearchId!),
        enabled: !!requestedSearchId && !selectedSearch,
    });

    // Query for Contacts of a specific search
    const { data: contactsData, isLoading: isContactsLoading } = useQuery({
        queryKey: ['search-results', selectedSearch?.id, contactsPage, favoritesOnly, sortBy, sortDirection, showArchived],
        queryFn: () => searchApi.getResults(selectedSearch!.id, contactsPage, 20, favoritesOnly, sortBy, sortDirection, showArchived),
        enabled: !!selectedSearch,
    });

    const { data: selectedSearchStatus } = useQuery({
        queryKey: ['search-status', selectedSearch?.id],
        queryFn: () => searchApi.getStatus(selectedSearch!.id),
        enabled: !!selectedSearch && (selectedSearch.status === 'running' || selectedSearch.status === 'pending'),
        refetchInterval: 5000,
        refetchOnWindowFocus: false,
    });

    const { data: settingsData } = useQuery({
        queryKey: ['public-settings'],
        queryFn: () => settingsApi.getPublic(),
    });

    const toggleFavoriteMutation = useMutation({
        mutationFn: (contactId: string) => contactsApi.toggleFavorite(contactId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['search-results'] });
        },
        onError: (error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to update favorite';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const toggleArchiveMutation = useMutation({
        mutationFn: (contactId: string) => contactsApi.toggleArchive(contactId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['search-results'] });
        },
        onError: (error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to archive contact';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const pauseSearchMutation = useMutation({
        mutationFn: (searchId: string) => searchApi.pause(searchId),
        onSuccess: (_data, searchId) => {
            queryClient.invalidateQueries({ queryKey: ['search-history'] });
            queryClient.invalidateQueries({ queryKey: ['search-status', searchId] });

            setSelectedSearch((current) => current && current.id === searchId
                ? {
                    ...current,
                    status: 'paused',
                    completedAt: new Date().toISOString(),
                }
                : current);

            toast({
                title: 'Search Paused',
                description: 'The scraping task was paused successfully.',
            });
        },
        onError: (error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to pause search';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    useEffect(() => {
        if (!selectedSearch || !selectedSearchStatus) return;

        setSelectedSearch((current) => {
            if (!current || current.id !== selectedSearch.id) {
                return current;
            }

            return {
                ...current,
                status: selectedSearchStatus.status,
                totalResults: selectedSearchStatus.totalResults ?? current.totalResults,
                savedResults: selectedSearchStatus.savedResults ?? current.savedResults,
                creditsUsed: selectedSearchStatus.creditsUsed ?? current.creditsUsed,
                completedAt: selectedSearchStatus.completedAt ?? current.completedAt,
            };
        });
    }, [selectedSearch, selectedSearchStatus]);

    useEffect(() => {
        if (!requestedSearchData?.search || selectedSearch) return;
        setSelectedSearch(requestedSearchData.search);
    }, [requestedSearchData, selectedSearch]);

    useEffect(() => {
        setContactsPage(1);
    }, [favoritesOnly, showArchived, selectedSearch?.id, sortBy, sortDirection]);

    const handleExportCsv = async (searchId?: string) => {
        try {
            // If we're viewing a specific search, we might want to export only those contacts
            // For now, using the global export or we can add a per-search export if available
            const blob = await contactsApi.exportCsv();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `search-results-${searchId || 'all'}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to export contacts' });
        }
    };

    const isSearchActive = (status: string) => status === 'running' || status === 'pending';
    const isAdmin = user?.role === 'admin';
    const creditsPerStandardLead = settingsData?.settings.creditsPerStandardResult ?? 1;
    const creditsPerEnrichedLead = settingsData?.settings.creditsPerEnrichedResult ?? 3;
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

    const handlePauseSearch = (searchId: string) => {
        pauseSearchMutation.mutate(searchId);
    };

    const handleSort = (column: SearchResultsSortBy) => {
        if (sortBy === column) {
            setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
            return;
        }

        setSortBy(column);
        setSortDirection('asc');
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'running': return <Loader2 className="h-4 w-4 animate-spin text-amber-500" />;
            case 'paused': return <PauseCircle className="h-4 w-4 text-slate-500" />;
            default: return <PlayCircle className="h-4 w-4 text-yellow-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 min-w-[90px] justify-center">Completed</Badge>;
            case 'failed': return <Badge variant="destructive" className="bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border-red-200 dark:border-red-500/20 min-w-[90px] justify-center">Failed</Badge>;
            case 'running': return <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 min-w-[90px] justify-center">Running</Badge>;
            case 'paused': return <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-500/10 text-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-500/20 min-w-[90px] justify-center">Paused</Badge>;
            default: return <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20 min-w-[90px] justify-center">Pending</Badge>;
        }
    };

    // Show loading if we're waiting for a specific search to load
    const isLoadingRequestedSearch = !!requestedSearchId && !selectedSearch && !requestedSearchData;

    // Render History List
    if (!selectedSearch) {
        return (
            <div className="w-full space-y-6">
                {isHistoryLoading || isLoadingRequestedSearch ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : historyData?.history.length === 0 ? (
                    <Card className="border-dashed py-20 rounded-[28px]">
                        <div className="flex flex-col items-center justify-center text-center">
                            <Clock className="h-16 w-16 text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-semibold">No searches yet</h3>
                            <p className="text-muted-foreground max-w-sm mt-2">
                                When you start a new search, it will appear here in your backlog.
                            </p>
                        </div>
                    </Card>
                ) : (
                    <>
                    <Card className="overflow-hidden">
                        <div className="divide-y divide-border">
                        {historyData?.history.map((search, index) => (
                            <motion.div
                                key={search.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.03 }}
                                onClick={() => {
                                    setSelectedSearch(search);
                                    setLocation(`/searches?searchId=${search.id}`);
                                }}
                                className="group flex cursor-pointer items-start gap-3 px-4 py-3.5 sm:px-5 sm:py-4 sm:items-center transition-colors hover:bg-muted/40"
                            >
                                {isSearchActive(search.status) ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handlePauseSearch(search.id);
                                        }}
                                        disabled={pauseSearchMutation.isPending}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 transition-colors hover:border-primary/20 hover:bg-primary/5 disabled:opacity-50"
                                    >
                                        {pauseSearchMutation.isPending && pauseSearchMutation.variables === search.id ? (
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
                                        <p className="truncate text-sm font-semibold text-foreground capitalize">
                                            {search.query}
                                        </p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                                                <MapPin className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{search.location}</span>
                                            </span>
                                            <span className="opacity-40 hidden xs:inline">·</span>
                                            <span className="shrink-0">{format(new Date(search.createdAt), 'MMM d, yyyy')}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-muted-foreground sm:hidden">
                                        <div className="flex items-center gap-1">
                                            <span className="tabular-nums text-sm font-semibold text-foreground">{search.savedResults || 0}</span>
                                            <span>contacts</span>
                                        </div>
                                        {!isAdmin && <span className="opacity-40">·</span>}
                                        {!isAdmin && (
                                            <div className="flex items-center gap-1">
                                                <span className="tabular-nums text-sm font-semibold text-foreground">{getDisplayedSearchCredits(search)}</span>
                                                <span>credits</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="hidden sm:flex items-center gap-8 text-xs text-muted-foreground">
                                    <div className="text-center min-w-[60px]">
                                        <p className="tabular-nums text-sm font-semibold text-foreground">{search.savedResults || 0}</p>
                                        <p className="text-xs">contacts</p>
                                    </div>
                                    {!isAdmin && (
                                        <div className="text-center min-w-[60px]">
                                            <p className="tabular-nums text-sm font-semibold text-foreground">{getDisplayedSearchCredits(search)}</p>
                                            <p className="text-xs">credits</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {getStatusBadge(search.status)}
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 hidden sm:block" />
                                </div>
                            </motion.div>
                        ))}

                        </div>
                    </Card>

                    {historyData && historyData.totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-center gap-4">
                            <Button variant="outline" disabled={historyPage === 1} onClick={() => setHistoryPage(historyPage - 1)}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {historyData.page} of {historyData.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                disabled={historyPage === historyData.totalPages}
                                onClick={() => setHistoryPage(historyPage + 1)}
                            >
                                Next
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    </>
                )}
            </div>
        );
    }

    // Render Contacts for specific search
    const contacts = contactsData?.results ?? [];
    const totalContacts = contactsData?.total ?? 0;
    const totalPages = contactsData?.totalPages ?? 1;
    const archivedCount = contactsData?.archivedCount ?? 0;

    return (
        <div className="w-full space-y-8">
            <div className="flex flex-col gap-4">
                <Button 
                    variant="ghost" 
                    className="w-fit text-muted-foreground hover:text-foreground"
                    onClick={() => {
                        setSelectedSearch(null);
                        setFavoritesOnly(false);
                        setShowArchived(false);
                        setLocation('/searches');
                    }}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to History
                </Button>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground capitalize">
                                {selectedSearch.query}
                            </h1>
                            {getStatusBadge(selectedSearch.status)}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {selectedSearch.location}
                            </span>
                            <span className="opacity-40">·</span>
                            <span>{format(new Date(selectedSearch.createdAt), 'MMM d, yyyy')}</span>
                            <span className="opacity-40">·</span>
                            <span>{totalContacts} contacts</span>
                        </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 md:w-auto md:items-end md:pl-4">
                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            {isSearchActive(selectedSearch.status) && (
                                <Button
                                    variant="outline"
                                    onClick={() => handlePauseSearch(selectedSearch.id)}
                                    disabled={pauseSearchMutation.isPending}
                                >
                                    {pauseSearchMutation.isPending && pauseSearchMutation.variables === selectedSearch.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <PauseCircle className="mr-2 h-4 w-4" />
                                    )}
                                    Pause
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => setIsMapDialogOpen(true)}
                                disabled={contacts.length === 0}
                            >
                                <Map className="mr-2 h-4 w-4" />
                                View Map
                            </Button>
                            <Button variant="outline" onClick={() => handleExportCsv(selectedSearch.id)}>
                                <Download className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-1 md:w-full md:justify-end">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9"
                                    disabled={contactsPage === 1}
                                    onClick={() => setContactsPage(contactsPage - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <Button
                                        key={page}
                                        variant={contactsPage === page ? "default" : "outline"}
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() => setContactsPage(page)}
                                    >
                                        {page}
                                    </Button>
                                ))}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9"
                                    disabled={contactsPage === totalPages}
                                    onClick={() => setContactsPage(contactsPage + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isContactsLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : (
                <Card className="overflow-hidden rounded-[28px] border-border">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-border bg-muted/30">
                                <tr>
                                    <th className="w-14 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <button
                                            type="button"
                                            onClick={() => setFavoritesOnly((current) => !current)}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted"
                                            title={favoritesOnly ? 'Show all contacts' : 'Show only favorites'}
                                            aria-pressed={favoritesOnly}
                                            aria-label={favoritesOnly ? 'Show all contacts' : 'Show only favorites'}
                                        >
                                            <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('business')}
                                            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                                        >
                                            <span>Business</span>
                                            <ArrowUpDown className={`h-3.5 w-3.5 ${sortBy === 'business' ? 'text-foreground' : ''}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('contact')}
                                            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                                        >
                                            <span>Contact</span>
                                            <ArrowUpDown className={`h-3.5 w-3.5 ${sortBy === 'contact' ? 'text-foreground' : ''}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('location')}
                                            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                                        >
                                            <span>Location</span>
                                            <ArrowUpDown className={`h-3.5 w-3.5 ${sortBy === 'location' ? 'text-foreground' : ''}`} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rating</th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links</th>
                                    <th className="w-10 px-2 py-3.5 text-right">
                                        {archivedCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowArchived((current) => !current)}
                                                className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted ml-auto ${showArchived ? 'text-foreground' : 'text-muted-foreground/40'}`}
                                                title={showArchived ? 'Hide archived contacts' : `Show ${archivedCount} archived contacts`}
                                            >
                                                <Archive className="h-3.5 w-3.5" />
                                                {!showArchived && (
                                                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-muted-foreground/20 text-[9px] font-medium text-muted-foreground px-0.5">
                                                        {archivedCount}
                                                    </span>
                                                )}
                                            </button>
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {contacts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-16 text-center">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <Search className="mb-4 h-16 w-16 text-muted-foreground/30" />
                                                <h3 className="text-xl font-semibold">
                                                    {showArchived && !favoritesOnly
                                                        ? 'No archived contacts'
                                                        : favoritesOnly
                                                            ? 'No favorite contacts in this search'
                                                            : 'No contacts found for this search'}
                                                </h3>
                                                <p className="mt-2 max-w-sm text-muted-foreground">
                                                    {showArchived && !favoritesOnly
                                                        ? 'Archived contacts will appear here when you hide leads from the main list.'
                                                        : favoritesOnly
                                                            ? 'Click the star in the first column to show all contacts again.'
                                                            : 'Try launching a new search with different keywords or location.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                contacts.map((contact, index) => (
                                    <motion.tr
                                        key={contact.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: contact.isArchived ? 0.45 : 1 }}
                                        transition={{ delay: index * 0.02 }}
                                        className={`group hover:bg-muted/20 transition-colors ${contact.isArchived ? 'opacity-45' : ''}`}
                                    >
                                        {/* Favorite */}
                                        <td className="w-14 px-4 py-4 align-middle">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg hover:bg-muted"
                                                onClick={() => toggleFavoriteMutation.mutate(contact.id)}
                                            >
                                                <Star
                                                    className={`h-4 w-4 ${contact.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                                                />
                                            </Button>
                                        </td>

                                        {/* Business Name & Category */}
                                        <td className="px-4 py-4 align-middle">
                                            <div className="max-w-xs">
                                                <p className="font-semibold text-foreground leading-tight">{contact.title}</p>
                                                {contact.category && (
                                                    <p className="mt-1 text-xs text-muted-foreground truncate">{contact.category}</p>
                                                )}
                                            </div>
                                        </td>

                                        {/* Contact Info */}
                                        <td className="px-4 py-4 align-middle">
                                            <div className="space-y-1.5 text-sm max-w-xs">
                                                {contact.phone && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                                        <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors truncate">
                                                            {contact.phone}
                                                        </a>
                                                    </div>
                                                )}
                                                {(selectedSearch.requestEnrichment || contact.email) && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                                        {contact.email ? (
                                                            <a
                                                                href={`mailto:${contact.email}`}
                                                                className="hover:text-primary transition-colors truncate"
                                                            >
                                                                {contact.email}
                                                            </a>
                                                        ) : (
                                                            <span className="truncate">-</span>
                                                        )}
                                                    </div>
                                                )}
                                                {contact.website && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Globe className="h-3.5 w-3.5 shrink-0" />
                                                        <a
                                                            href={contact.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="hover:text-primary transition-colors truncate"
                                                        >
                                                            {contact.website.replace(/^https?:\/\//, '')}
                                                        </a>
                                                    </div>
                                                )}
                                                {!contact.phone && !contact.email && !contact.website && (
                                                    <span className="text-xs text-muted-foreground/50">No contact info</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Address */}
                                        <td className="px-4 py-4 align-middle">
                                            {contact.address ? (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-sm text-muted-foreground max-w-xs hover:text-primary transition-colors group"
                                                >
                                                    <MapPin className="h-3.5 w-3.5 shrink-0 group-hover:text-primary transition-colors" />
                                                    <span className="line-clamp-2 leading-tight">{contact.address}</span>
                                                </a>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/50">No address</span>
                                            )}
                                        </td>

                                        {/* Rating */}
                                        <td className="px-4 py-4 align-middle">
                                            {contact.rating ? (
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                                    <span className="font-medium text-foreground">{contact.rating}</span>
                                                    <span className="text-xs text-muted-foreground">({contact.reviewCount})</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/50">No rating</span>
                                            )}
                                        </td>

                                        {/* Social Links */}
                                        <td className="px-4 py-4 align-middle">
                                            <div className="flex items-center gap-2">
                                                {contact.facebook && (
                                                    <a
                                                        href={contact.facebook}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-[#1877F2] transition-colors"
                                                        title="Facebook"
                                                    >
                                                        <Facebook className="h-4 w-4" />
                                                    </a>
                                                )}
                                                {contact.instagram && (
                                                    <a
                                                        href={contact.instagram}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-[#E4405F] transition-colors"
                                                        title="Instagram"
                                                    >
                                                        <Instagram className="h-4 w-4" />
                                                    </a>
                                                )}
                                                {contact.twitter && (
                                                    <a
                                                        href={contact.twitter}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                                                        title="Twitter/X"
                                                    >
                                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                                        </svg>
                                                    </a>
                                                )}
                                                {contact.linkedin && (
                                                    <a
                                                        href={contact.linkedin}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-[#0A66C2] transition-colors"
                                                        title="LinkedIn"
                                                    >
                                                        <Linkedin className="h-4 w-4" />
                                                    </a>
                                                )}
                                                {contact.youtube && (
                                                    <a
                                                        href={contact.youtube}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-[#FF0000] transition-colors"
                                                        title="YouTube"
                                                    >
                                                        <Youtube className="h-4 w-4" />
                                                    </a>
                                                )}
                                                {contact.tiktok && (
                                                    <a
                                                        href={contact.tiktok}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                                        title="TikTok"
                                                    >
                                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                                                        </svg>
                                                    </a>
                                                )}
                                                {contact.pinterest && (
                                                    <a
                                                        href={contact.pinterest}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-[#E60023] transition-colors"
                                                        title="Pinterest"
                                                    >
                                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                                                        </svg>
                                                    </a>
                                                )}
                                                {contact.googleMapsUrl && (
                                                    <a
                                                        href={contact.googleMapsUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-primary transition-colors"
                                                        title="Google Maps"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                )}
                                                {!contact.facebook && !contact.instagram && !contact.twitter && !contact.linkedin && !contact.youtube && !contact.tiktok && !contact.pinterest && !contact.googleMapsUrl && (
                                                    <span className="text-xs text-muted-foreground/50">No links</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Archive */}
                                        <td className="w-10 px-2 py-4 align-middle">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-7 w-7 rounded-lg transition-all ${
                                                    contact.isArchived
                                                        ? 'text-muted-foreground hover:text-foreground opacity-100'
                                                        : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground'
                                                }`}
                                                onClick={() => toggleArchiveMutation.mutate(contact.id)}
                                                title={contact.isArchived ? 'Unarchive contact' : 'Archive contact'}
                                            >
                                                {contact.isArchived
                                                    ? <ArchiveRestore className="h-3.5 w-3.5" />
                                                    : <Archive className="h-3.5 w-3.5" />
                                                }
                                            </Button>
                                        </td>
                                    </motion.tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Map Dialog */}
            <ContactsMapDialog
                open={isMapDialogOpen}
                onOpenChange={setIsMapDialogOpen}
                contacts={contacts}
                searchQuery={selectedSearch.query}
                searchLocation={selectedSearch.location}
            />
        </div>
    );
}
