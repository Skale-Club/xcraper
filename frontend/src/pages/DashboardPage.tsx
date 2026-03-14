import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { searchApi, contactsApi, ApiError, SearchHistory, SearchStatus } from '@/lib/api';
import {
    Search,
    MapPin,
    Database,
    Clock,
    Coins,
    Loader2,
    CheckCircle,
    XCircle,
    AlertCircle,
    ChevronRight,
} from 'lucide-react';

export default function DashboardPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [maxResults, setMaxResults] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);

    // Fetch search history
    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ['search-history'],
        queryFn: () => searchApi.getHistory(1, 5),
    });

    // Fetch contacts count
    const { data: contactsData } = useQuery({
        queryKey: ['contacts-count'],
        queryFn: () => contactsApi.getAll(1, 1),
    });

    // Poll for search status when there's an active search
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

                    // Refresh data
                    queryClient.invalidateQueries({ queryKey: ['search-history'] });
                    queryClient.invalidateQueries({ queryKey: ['contacts-count'] });

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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!query.trim() || !location.trim()) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Please fill in both search query and location',
            });
            return;
        }

        setIsLoading(true);
        try {
            const response = await searchApi.start(query, location, maxResults);
            setActiveSearchId(response.searchId);
            setSearchStatus({ status: 'running' });

            // Refresh history
            queryClient.invalidateQueries({ queryKey: ['search-history'] });

            toast({
                title: 'Search Started',
                description: 'Your scraping task has been initiated...',
            });

            // Clear form
            setQuery('');
            setLocation('');
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
    const totalContacts = contactsData?.pagination?.total ?? 0;
    const totalSearches = searchHistory.length;

    const stats = [
        {
            title: 'Available Credits',
            value: user?.credits ?? 0,
            icon: Coins,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
        },
        {
            title: 'Total Searches',
            value: totalSearches,
            icon: Search,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            title: 'Contacts Saved',
            value: totalContacts,
            icon: Database,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
        },
    ];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-600" />;
            case 'running':
                return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
            default:
                return <AlertCircle className="w-5 h-5 text-yellow-600" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            case 'running':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-yellow-100 text-yellow-800';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Active Search Status */}
                {activeSearchId && searchStatus && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6"
                    >
                        <Card className="border-blue-200 bg-blue-50">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                    <div className="flex-1">
                                        <p className="font-medium text-blue-900">Search in Progress</p>
                                        <p className="text-sm text-blue-700">
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

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">{stat.title}</p>
                                            <p className="text-3xl font-bold mt-1">{stat.value}</p>
                                        </div>
                                        <div className={`p-3 rounded-full ${stat.bgColor}`}>
                                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Search Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Search className="w-5 h-5" />
                                New Search
                            </CardTitle>
                            <CardDescription>
                                Search for businesses on Google Maps and extract their contact information.
                                Each search costs 1 credit + 1 credit per contact saved.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSearch} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="query">What are you looking for?</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                id="query"
                                                type="text"
                                                placeholder="e.g., Restaurants, Dentists, Gyms"
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                className="pl-10"
                                                disabled={isLoading || !!activeSearchId}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="location">Location</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                id="location"
                                                type="text"
                                                placeholder="e.g., New York, NY"
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                                className="pl-10"
                                                disabled={isLoading || !!activeSearchId}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="maxResults">Maximum Results</Label>
                                    <Input
                                        id="maxResults"
                                        type="number"
                                        min={1}
                                        max={500}
                                        value={maxResults}
                                        onChange={(e) => setMaxResults(parseInt(e.target.value) || 50)}
                                        className="w-full md:w-48"
                                        disabled={isLoading || !!activeSearchId}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isLoading || !!activeSearchId}
                                    className="w-full md:w-auto"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Starting Search...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-4 h-4 mr-2" />
                                            Start Scraping
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Recent Searches */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="w-5 h-5" />
                                    Recent Searches
                                </CardTitle>
                                {searchHistory.length > 0 && (
                                    <Button variant="ghost" size="sm">
                                        View All
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : searchHistory.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No searches yet. Start your first search above!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {searchHistory.map((search: SearchHistory) => (
                                        <div
                                            key={search.id}
                                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                {getStatusIcon(search.status)}
                                                <div>
                                                    <p className="font-medium">{search.query}</p>
                                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {search.location}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(search.status)}`}>
                                                        {search.status}
                                                    </span>
                                                    {search.totalResults !== undefined && (
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {search.totalResults} results
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {search.creditsUsed} credits
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(search.createdAt).toLocaleDateString()}
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
            </main>
        </div>
    );
}
