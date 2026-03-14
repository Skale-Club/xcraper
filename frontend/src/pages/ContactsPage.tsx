import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFavorites, setShowFavorites] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

    const { data, isLoading } = useQuery({
        queryKey: ['contacts', page, searchQuery, showFavorites],
        queryFn: () => contactsApi.getAll(page, 20, searchQuery || undefined, showFavorites || undefined),
    });

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
        setSelectedContacts((prev) =>
            prev.includes(contactId)
                ? prev.filter((id) => id !== contactId)
                : [...prev, contactId],
        );
    };

    const contacts = data?.contacts ?? [];
    const pagination = data?.pagination;

    return (
        <div className="mx-auto max-w-7xl space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                            <div className="flex w-full flex-1 items-center gap-4 md:w-auto">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                                    <Star className={`mr-2 h-4 w-4 ${showFavorites ? 'fill-current' : ''}`} />
                                    Favorites
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={handleExportJson}>
                                    <Download className="mr-2 h-4 w-4" />
                                    JSON
                                </Button>
                                <Button variant="outline" onClick={handleExportCsv}>
                                    <Download className="mr-2 h-4 w-4" />
                                    CSV
                                </Button>
                                {selectedContacts.length > 0 && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => bulkDeleteMutation.mutate(selectedContacts)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete ({selectedContacts.length})
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : contacts.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                    <Search className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium text-foreground">No contacts found</h3>
                    <p className="mt-1 text-muted-foreground">
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
                                            className="mt-1 h-4 w-4 rounded border-input bg-background"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h3 className="flex items-center gap-2 font-semibold text-foreground">
                                                        {contact.title}
                                                        {contact.isFavorite && (
                                                            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                                        )}
                                                    </h3>
                                                    {contact.category && (
                                                        <p className="text-sm text-muted-foreground">{contact.category}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => toggleFavoriteMutation.mutate(contact.id)}
                                                    >
                                                        <Star
                                                            className={`h-4 w-4 ${contact.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`}
                                                        />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteMutation.mutate(contact.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                                {contact.address && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <MapPin className="h-4 w-4 flex-shrink-0" />
                                                        <span className="truncate">{contact.address}</span>
                                                    </div>
                                                )}
                                                {contact.phone && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Phone className="h-4 w-4 flex-shrink-0" />
                                                        <a href={`tel:${contact.phone}`} className="hover:text-primary">
                                                            {contact.phone}
                                                        </a>
                                                    </div>
                                                )}
                                                {contact.email && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Mail className="h-4 w-4 flex-shrink-0" />
                                                        <a
                                                            href={`mailto:${contact.email}`}
                                                            className="truncate hover:text-primary"
                                                        >
                                                            {contact.email}
                                                        </a>
                                                    </div>
                                                )}
                                                {contact.website && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Globe className="h-4 w-4 flex-shrink-0" />
                                                        <a
                                                            href={contact.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="truncate hover:text-primary"
                                                        >
                                                            {contact.website}
                                                        </a>
                                                    </div>
                                                )}
                                                {contact.rating && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Star className="h-4 w-4 flex-shrink-0 fill-yellow-500 text-yellow-500" />
                                                        <span>{contact.rating} ({contact.reviewCount} reviews)</span>
                                                    </div>
                                                )}
                                                {contact.googleMapsUrl && (
                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={contact.googleMapsUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-primary hover:underline"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
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

            {pagination && pagination.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-4">
                    <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </span>
                    <Button
                        variant="outline"
                        disabled={page === pagination.totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
