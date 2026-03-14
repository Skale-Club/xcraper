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
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Gift,
    RefreshCw
} from 'lucide-react';

function TransactionRow({ transaction }: {
    transaction: {
        id: string;
        amount: number;
        type: string;
        description?: string;
        createdAt: string;
        user: { id: string; name: string; email: string };
    }
}) {
    const getIcon = () => {
        switch (transaction.type) {
            case 'purchase':
                return <DollarSign className="h-4 w-4 text-green-600" />;
            case 'usage':
                return <ArrowDownRight className="h-4 w-4 text-red-600" />;
            case 'bonus':
                return <Gift className="h-4 w-4 text-purple-600" />;
            case 'refund':
                return <RefreshCw className="h-4 w-4 text-blue-600" />;
            default:
                return <ArrowUpRight className="h-4 w-4 text-gray-600" />;
        }
    };

    const getTypeLabel = () => {
        switch (transaction.type) {
            case 'purchase':
                return <span className="text-green-600">Purchase</span>;
            case 'usage':
                return <span className="text-red-600">Usage</span>;
            case 'bonus':
                return <span className="text-purple-600">Bonus</span>;
            case 'refund':
                return <span className="text-blue-600">Refund</span>;
            default:
                return <span className="text-gray-600">{transaction.type}</span>;
        }
    };

    return (
        <tr className="border-b">
            <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                    {getIcon()}
                    {getTypeLabel()}
                </div>
            </td>
            <td className="py-3 px-4">
                <span className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.amount >= 0 ? '+' : ''}{transaction.amount}
                </span>
            </td>
            <td className="py-3 px-4">
                <div>
                    <p className="font-medium">{transaction.user.name}</p>
                    <p className="text-sm text-muted-foreground">{transaction.user.email}</p>
                </div>
            </td>
            <td className="py-3 px-4">
                <span className="text-sm text-muted-foreground">
                    {transaction.description || '-'}
                </span>
            </td>
            <td className="py-3 px-4">
                <span className="text-sm text-muted-foreground">
                    {new Date(transaction.createdAt).toLocaleString()}
                </span>
            </td>
        </tr>
    );
}

export default function AdminTransactionsPage() {
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'transactions', page],
        queryFn: () => adminApi.getTransactions(page, 20),
    });

    // Filter transactions by search query
    const filteredTransactions = data?.transactions.filter(transaction =>
        transaction.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <PageIntro
                eyebrow="Admin"
                title="All Transactions"
                description="View all credit transactions across the platform"
            />

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Transactions</CardTitle>
                            <CardDescription>
                                {data?.pagination.total ?? 0} total transactions
                            </CardDescription>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search transactions..."
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
                                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Amount</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions?.map(transaction => (
                                            <TransactionRow key={transaction.id} transaction={transaction} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {filteredTransactions?.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    No transactions found
                                </div>
                            )}

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
