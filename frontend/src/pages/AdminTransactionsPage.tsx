import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminTransaction } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

function formatTransactionDate(value: string) {
    return new Date(value).toLocaleString();
}

function TransactionRow({ transaction }: {
    transaction: {
        id: string;
        amount: number;
        type: string;
        description?: string;
        subscriptionPlanName?: string | null;
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
        if (transaction.type === 'monthly_grant' && transaction.subscriptionPlanName) {
            return <span className="text-amber-600">{transaction.subscriptionPlanName}</span>;
        }

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
                    {formatTransactionDate(transaction.createdAt)}
                </span>
            </td>
        </tr>
    );
}

function TransactionCard({ transaction }: { transaction: AdminTransaction }) {
    const amountClassName = transaction.amount >= 0 ? 'text-green-600' : 'text-red-600';

    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                            {transaction.type === 'monthly_grant' && transaction.subscriptionPlanName
                                ? transaction.subscriptionPlanName
                                : transaction.type}
                        </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{transaction.user.name}</p>
                    <p className="text-sm text-muted-foreground break-all">{transaction.user.email}</p>
                </div>
                <span className={`text-base font-semibold ${amountClassName}`}>
                    {transaction.amount >= 0 ? '+' : ''}{transaction.amount}
                </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                    <p className="mt-1 text-sm text-foreground">{transaction.description || '-'}</p>
                </div>
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</p>
                    <p className="mt-1 text-sm text-foreground">{formatTransactionDate(transaction.createdAt)}</p>
                </div>
            </div>
        </div>
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
    const filteredTransactions = data?.transactions.filter((transaction: AdminTransaction) =>
        transaction.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.subscriptionPlanName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle>Transactions</CardTitle>
                            <CardDescription>
                                {data?.pagination.total ?? 0} total transactions
                            </CardDescription>
                        </div>
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search transactions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9"
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
                            <div className="space-y-3 md:hidden">
                                {filteredTransactions?.map(transaction => (
                                    <TransactionCard key={transaction.id} transaction={transaction} />
                                ))}
                            </div>

                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[720px]">
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
                                <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Page {data.pagination.page} of {data.pagination.totalPages}
                                    </p>
                                    <div className="flex gap-2 self-start sm:self-auto">
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
