import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { searchApi, contactsApi, settingsApi, ApiError, type SearchHistory } from '@/lib/api';
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
    const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);

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
        queryKey: ['search-results', selectedSearch?.id, contactsPage],
        queryFn: () => searchApi.getResults(selectedSearch!.id, contactsPage, 20),
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
            case 'completed': return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20">Completed</Badge>;
            case 'failed': return <Badge variant="destructive">Failed</Badge>;
            case 'running': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">Running</Badge>;
            case 'paused': return <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20">Paused</Badge>;
            default: return <Badge variant="outline">Pending</Badge>;
        }
    };

    // Render History List
    if (!selectedSearch) {
        return (
            <div className="w-full space-y-6">
                {isHistoryLoading ? (
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
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 transition-colors group-hover:border-primary/20 group-hover:bg-primary/5">
                                    {getStatusIcon(search.status)}
                                </div>

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
                                        <span className="opacity-40">·</span>
                                        <div className="flex items-center gap-1">
                                            <span className="tabular-nums text-sm font-semibold text-foreground">{getDisplayedSearchCredits(search)}</span>
                                            <span>credits</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="hidden sm:flex items-center gap-5 text-right text-xs text-muted-foreground">
                                    <div>
                                        <p className="tabular-nums text-sm font-semibold text-foreground">{search.savedResults || 0}</p>
                                        <p>contacts</p>
                                    </div>
                                    <div>
                                        <p className="tabular-nums text-sm font-semibold text-foreground">{getDisplayedSearchCredits(search)}</p>
                                        <p>credits</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {getStatusBadge(search.status)}
                                    {isSearchActive(search.status) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handlePauseSearch(search.id);
                                            }}
                                            disabled={pauseSearchMutation.isPending}
                                        >
                                            {pauseSearchMutation.isPending && pauseSearchMutation.variables === search.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <PauseCircle className="h-3.5 w-3.5" />
                                            )}
                                        </Button>
                                    )}
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

    return (
        <div className="w-full space-y-8">
            <div className="flex flex-col gap-4">
                <Button 
                    variant="ghost" 
                    className="w-fit text-muted-foreground hover:text-foreground"
                    onClick={() => {
                        setSelectedSearch(null);
                        setLocation('/searches');
                    }}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to History
                </Button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                    <div className="flex items-center gap-2">
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
                </div>
            </div>

            {isContactsLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : contacts.length === 0 ? (
                <Card className="border-dashed py-20 rounded-[28px]">
                    <div className="flex flex-col items-center justify-center text-center">
                        <Search className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h3 className="text-xl font-semibold">No contacts found for this search</h3>
                        <p className="text-muted-foreground max-w-sm mt-2">
                            Try launching a new search with different keywords or location.
                        </p>
                    </div>
                </Card>
            ) : (
                <Card className="overflow-hidden rounded-[28px] border-border">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-border bg-muted/30">
                                <tr>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Star className="h-3.5 w-3.5" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business</th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rating</th>
                                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {contacts.map((contact, index) => (
                                    <motion.tr
                                        key={contact.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: index * 0.02 }}
                                        className="group hover:bg-muted/20 transition-colors"
                                    >
                                        {/* Favorite */}
                                        <td className="px-4 py-4 align-top">
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
                                        <td className="px-4 py-4 align-top">
                                            <div className="max-w-xs">
                                                <p className="font-semibold text-foreground leading-tight">{contact.title}</p>
                                                {contact.category && (
                                                    <p className="mt-1 text-xs text-muted-foreground truncate">{contact.category}</p>
                                                )}
                                            </div>
                                        </td>

                                        {/* Contact Info */}
                                        <td className="px-4 py-4 align-top">
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
                                        <td className="px-4 py-4 align-top">
                                            {contact.address ? (
                                                <div className="flex items-start gap-2 text-sm text-muted-foreground max-w-xs">
                                                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2 leading-tight">{contact.address}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/50">No address</span>
                                            )}
                                        </td>

                                        {/* Rating */}
                                        <td className="px-4 py-4 align-top">
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

                                        {/* Actions */}
                                        <td className="px-4 py-4 align-top">
                                            {contact.googleMapsUrl && (
                                                <a
                                                    href={contact.googleMapsUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                    View
                                                </a>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-4">
                    <Button variant="outline" disabled={contactsPage === 1} onClick={() => setContactsPage(contactsPage - 1)}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {contactsPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        disabled={contactsPage === totalPages}
                        onClick={() => setContactsPage(contactsPage + 1)}
                    >
                        Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
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
