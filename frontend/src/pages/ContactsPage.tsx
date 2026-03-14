import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { contactsApi, ApiError } from '@/lib/api';
import {
    Search,
    Star,
    Trash2,
    Download,
    Phone,
    Mail,
    MapPin,
    Globe,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Loader2,
} from 'lucide-react';

export default function ContactsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFavorites, setShowFavorites] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

    // Fetch contacts
    const { data, isLoading } = useQuery({
        queryKey: ['contacts', page, searchQuery, showFavorites],
        queryFn: () => contactsApi.getAll(page, 20, searchQuery || undefined, showFavorites || undefined),
    });

    // Toggle favorite mutation
    const toggleFavoriteMutation = useMutation({
        mutationFn: (contactId: string) => contactsApi.toggleFavorite(contactId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
        },
        onError: (error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to update favorite';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    // Delete contact mutation
    const deleteMutation = useMutation({
        mutationFn: (contactId: string) => contactsApi.delete(contactId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            toast({ title: 'Contact deleted' });
        },
        onError: (error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to delete contact';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    // Bulk delete mutation
    const bulkDeleteMutation = useMutation({
        mutationFn: (contactIds: string[]) => contactsApi.bulkDelete(contactIds),
        onSuccess: () => {
            setSelectedContacts([]);
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            toast({ title: 'Contacts deleted' });
        },
        onError: (error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to delete contacts';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    // Export functions
    const handleExportJson = async () => {
        try {
            const blob = await contactsApi.exportJson();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'contacts.json';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to export contacts' });
        }
    };

    const handleExportCsv = async () => {
        try {
            const blob = await contactsApi.exportCsv();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'contacts.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to export contacts' });
        }
    };

    const toggleSelectContact = (contactId: string) => {
        setSelectedContacts(prev =>
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        );
    };

    const contacts = data?.contacts ?? [];
    const pagination = data?.pagination;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📇</span>
                        <h1 className="text-xl font-bold text-gray-900">My Contacts</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters and Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex flex-1 gap-4 items-center w-full md:w-auto">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            type="text"
                                            placeholder="Search contacts..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    <Button
                                        variant={showFavorites ? 'default' : 'outline'}
                                        onClick={() => setShowFavorites(!showFavorites)}
                                    >
                                        <Star className={`w-4 h-4 mr-2 ${showFavorites ? 'fill-current' : ''}`} />
                                        Favorites
                                    </Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={handleExportJson}>
                                        <Download className="w-4 h-4 mr-2" />
                                        JSON
                                    </Button>
                                    <Button variant="outline" onClick={handleExportCsv}>
                                        <Download className="w-4 h-4 mr-2" />
                                        CSV
                                    </Button>
                                    {selectedContacts.length > 0 && (
                                        <Button
                                            variant="destructive"
                                            onClick={() => bulkDeleteMutation.mutate(selectedContacts)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete ({selectedContacts.length})
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Contacts List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : contacts.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12"
                    >
                        <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900">No contacts found</h3>
                        <p className="text-gray-500 mt-1">
                            {searchQuery || showFavorites
                                ? 'Try adjusting your filters'
                                : 'Start a search to collect contacts'}
                        </p>
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        {contacts.map((contact, index) => (
                            <motion.div
                                key={contact.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedContacts.includes(contact.id)}
                                                onChange={() => toggleSelectContact(contact.id)}
                                                className="mt-1 h-4 w-4 rounded border-gray-300"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                                            {contact.title}
                                                            {contact.isFavorite && (
                                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                            )}
                                                        </h3>
                                                        {contact.category && (
                                                            <p className="text-sm text-gray-500">{contact.category}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => toggleFavoriteMutation.mutate(contact.id)}
                                                        >
                                                            <Star
                                                                className={`w-4 h-4 ${contact.isFavorite ? 'text-yellow-500 fill-yellow-500' : ''
                                                                    }`}
                                                            />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => deleteMutation.mutate(contact.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                                    {contact.address && (
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <MapPin className="w-4 h-4 flex-shrink-0" />
                                                            <span className="truncate">{contact.address}</span>
                                                        </div>
                                                    )}
                                                    {contact.phone && (
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <Phone className="w-4 h-4 flex-shrink-0" />
                                                            <a href={`tel:${contact.phone}`} className="hover:text-primary">
                                                                {contact.phone}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {contact.email && (
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <Mail className="w-4 h-4 flex-shrink-0" />
                                                            <a href={`mailto:${contact.email}`} className="hover:text-primary truncate">
                                                                {contact.email}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {contact.website && (
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <Globe className="w-4 h-4 flex-shrink-0" />
                                                            <a
                                                                href={contact.website}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="hover:text-primary truncate"
                                                            >
                                                                {contact.website}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {contact.rating && (
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <Star className="w-4 h-4 flex-shrink-0 fill-yellow-500 text-yellow-500" />
                                                            <span>{contact.rating} ({contact.reviewCount} reviews)</span>
                                                        </div>
                                                    )}
                                                    {contact.googleMapsUrl && (
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={contact.googleMapsUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary hover:underline flex items-center gap-1"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                                View on Maps
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <Button
                            variant="outline"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                        </span>
                        <Button
                            variant="outline"
                            disabled={page === pagination.totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            Next
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
