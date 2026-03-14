import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { creditsApi, CreditTransaction } from '@/lib/api';

const BillingHistoryPage = () => {
    const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        const loadTransactions = async () => {
            setLoading(true);
            try {
                const data = await creditsApi.getHistory(page, 20);
                setTransactions(data.transactions);
                setTotalPages(data.totalPages);
            } catch (err) {
                console.error('Failed to load transactions:', err);
            } finally {
                setLoading(false);
            }
        };

        loadTransactions();
    }, [page]);

    const getTypeLabel = (type: CreditTransaction['type']) => {
        const labels: Record<CreditTransaction['type'], string> = {
            monthly_grant: 'Monthly Grant',
            purchase: 'Purchase',
            usage: 'Usage',
            refund: 'Refund',
            bonus: 'Bonus',
            top_up: 'Top-up',
            rollover: 'Rollover',
            expired: 'Expired',
            adjustment: 'Adjustment',
        };
        return labels[type] || type;
    };

    const getTypeVariant = (type: CreditTransaction['type']): 'default' | 'secondary' | 'destructive' | 'outline' => {
        if (['purchase', 'monthly_grant', 'bonus', 'top_up', 'rollover', 'refund'].includes(type)) {
            return 'default';
        }
        if (['usage', 'expired'].includes(type)) {
            return 'destructive';
        }
        return 'secondary';
    };

    const formatAmount = (amount: number) => {
        const prefix = amount >= 0 ? '+' : '';
        return `${prefix}${amount}`;
    };

    return (
        <div className="w-full space-y-8">
            <h1 className="text-3xl font-bold mb-6">Billing History</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading && transactions.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No transactions yet
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {transactions.map((tx) => (
                                <div
                                    key={tx.id}
                                    className="flex items-center justify-between p-4 rounded-lg border"
                                >
                                    <div className="flex items-center gap-4">
                                        <Badge variant={getTypeVariant(tx.type)}>
                                            {getTypeLabel(tx.type)}
                                        </Badge>
                                        <div>
                                            <p className="font-medium">{tx.description || getTypeLabel(tx.type)}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(tx.createdAt).toLocaleDateString()} at{' '}
                                                {new Date(tx.createdAt).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-lg font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatAmount(tx.amount)} credits
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default BillingHistoryPage;
