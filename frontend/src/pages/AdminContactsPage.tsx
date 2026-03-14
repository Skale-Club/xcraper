import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageIntro from '@/components/app/PageIntro';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Contact,
    Phone,
    Mail,
    Globe,
    MapPin,
    Star,
    ExternalLink
} from 'lucide-react';

export default function AdminContactsPage() {
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'contacts', page],
        queryFn: () => adminApi.getContacts(page, 20),
    });

    // Filter contacts by search query
    const filteredContacts = data?.contacts.filter(contact =>
        contact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Admin"
                title="All Contacts"
                description="View all contacts saved by users across the platform"
            />

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Contacts</CardTitle>
                            <CardDescription>
                                {data?.pagination.total ?? 0} total contacts
                            </CardDescription>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search contacts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 w-64"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                {filteredContacts?.map(contact => (
                                    <div
                                        key={contact.id}
                                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-2 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Contact className="h-4 w-4 text-muted-foreground" />
                                                    <h3 className="font-medium">{contact.title}</h3>
                                                    {contact.category && (
                                                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                                            {contact.category}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                                                    {contact.phone && (
                                                        <div className="flex items-center gap-1">
                                                            <Phone className="h-3 w-3" />
                                                            <span>{contact.phone}</span>
                                                        </div>
                                                    )}
                                                    {contact.email && (
                                                        <div className="flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            <span className="truncate">{contact.email}</span>
                                                        </div>
                                                    )}
                                                    {contact.website && (
                                                        <a
                                                            href={contact.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 hover:text-primary"
                                                        >
                                                            <Globe className="h-3 w-3" />
                                                            <span className="truncate">Website</span>
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    )}
                                                    {contact.rating && (
                                                        <div className="flex items-center gap-1">
                                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                            <span>{contact.rating}</span>
                                                            {contact.reviewCount && (
                                                                <span>({contact.reviewCount})</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {contact.address && (
                                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                        <MapPin className="h-3 w-3" />
                                                        <span>{contact.address}</span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
                                                    <span>Saved by:</span>
                                                    <span className="font-medium">{contact.user.name}</span>
                                                    <span>({contact.user.email})</span>
                                                    <span className="ml-auto">
                                                        {new Date(contact.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {filteredContacts?.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No contacts found
                                    </div>
                                )}
                            </div>

                            {/* Pagination */}
                            {data && data.pagination.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Page {data.pagination.page} of {data.pagination.totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                                            disabled={page === data.pagination.totalPages}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
