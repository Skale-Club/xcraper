import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import PageIntro from '@/components/app/PageIntro';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { creditsApi, paymentsApi, ApiError, CreditTransaction, CreditPackage } from '@/lib/api';
import {
    Coins,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Loader2,
} from 'lucide-react';

export default function CreditsPage() {
    const { user, refreshUser } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);
    const [verifyingPayment, setVerifyingPayment] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');
        const sessionId = params.get('session_id');

        if (paymentStatus === 'success' && sessionId) {
            setVerifyingPayment(true);
            paymentsApi.verifyPayment(sessionId)
                .then(async (data) => {
                    await refreshUser();
                    queryClient.invalidateQueries({ queryKey: ['credit-history'] });
                    toast({
                        title: 'Payment Successful!',
                        description: `${data.credits} credits have been added to your account.`,
                    });
                    window.history.replaceState({}, '', window.location.pathname);
                })
                .catch((error: Error) => {
                    const message = error instanceof ApiError ? error.message : 'Payment verification failed';
                    toast({ variant: 'destructive', title: 'Error', description: message });
                })
                .finally(() => setVerifyingPayment(false));
        } else if (paymentStatus === 'cancel') {
            toast({
                variant: 'destructive',
                title: 'Payment Cancelled',
                description: 'Your payment was cancelled. Please try again.',
            });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [toast, refreshUser, queryClient]);

    const { data: packagesData } = useQuery({
        queryKey: ['credit-packages'],
        queryFn: () => paymentsApi.getPackages(),
    });

    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ['credit-history'],
        queryFn: () => creditsApi.getHistory(1, 20),
    });

    const checkoutMutation = useMutation({
        mutationFn: (packageId: string) => paymentsApi.createCheckout(packageId),
        onSuccess: (data) => {
            window.location.href = data.url;
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to create checkout session';
            toast({ variant: 'destructive', title: 'Error', description: message });
            setPurchasingPackage(null);
        },
    });

    const handlePurchase = (packageId: string) => {
        setPurchasingPackage(packageId);
        checkoutMutation.mutate(packageId);
    };

    const packages: CreditPackage[] = packagesData?.packages ?? [];
    const transactions = historyData?.transactions ?? [];

    const getTransactionIcon = (type: CreditTransaction['type']) => {
        switch (type) {
            case 'purchase':
            case 'bonus':
                return <ArrowUpRight className="h-4 w-4 text-green-600" />;
            case 'usage':
                return <ArrowDownRight className="h-4 w-4 text-red-600" />;
            case 'refund':
                return <ArrowUpRight className="h-4 w-4 text-blue-600" />;
            default:
                return <Coins className="h-4 w-4" />;
        }
    };

    const getTransactionTypeLabel = (type: CreditTransaction['type']) => {
        switch (type) {
            case 'purchase':
                return 'Purchase';
            case 'bonus':
                return 'Bonus';
            case 'usage':
                return 'Usage';
            case 'refund':
                return 'Refund';
            default:
                return type;
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-8">
            <PageIntro
                eyebrow="Billing"
                title="Credits"
                description="Track your current balance, buy more credits, and review every transaction in one place."
            />

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-100">Current Balance</p>
                                <p className="mt-2 text-5xl font-bold">{user?.credits ?? 0}</p>
                                <p className="mt-2 text-blue-100">credits available</p>
                            </div>
                            <div className="rounded-full bg-white/10 p-4">
                                <Coins className="h-16 w-16" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {verifyingPayment && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                >
                    <Card className="mx-4 w-full max-w-md">
                        <CardContent className="p-8 text-center">
                            <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-primary" />
                            <h3 className="mb-2 text-xl font-bold">Verifying Payment...</h3>
                            <p className="text-gray-500">Please wait while we confirm your payment.</p>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
            >
                <div>
                    <h3 className="text-xl font-semibold text-slate-950">Purchase Credits</h3>
                    <p className="text-sm text-slate-500">Pick a package and continue to checkout.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {packages.map((pkg, index) => (
                        <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + index * 0.05 }}
                        >
                            <Card className={`relative overflow-hidden hover:shadow-lg transition-shadow ${pkg.isPopular ? 'ring-2 ring-primary' : ''}`}>
                                {pkg.isPopular && (
                                    <div className="absolute right-0 top-0 bg-primary px-3 py-1 text-xs text-primary-foreground">
                                        Most Popular
                                    </div>
                                )}
                                <CardHeader className="pb-2 text-center">
                                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                                    <div className="mt-2">
                                        <span className="text-3xl font-bold">${pkg.price}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-center">
                                    <p className="mb-2 text-2xl font-bold text-primary">{pkg.credits} credits</p>
                                    {pkg.description && (
                                        <p className="mb-2 text-sm text-gray-600">{pkg.description}</p>
                                    )}
                                    <p className="mb-4 text-sm text-gray-500">
                                        ${(parseFloat(pkg.price) / pkg.credits).toFixed(3)} per credit
                                    </p>
                                    <Button
                                        className="w-full"
                                        onClick={() => handlePurchase(pkg.id)}
                                        disabled={purchasingPackage !== null}
                                    >
                                        {purchasingPackage === pkg.id ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Redirecting...
                                            </>
                                        ) : (
                                            'Purchase'
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Transaction History
                        </CardTitle>
                        <CardDescription>Your recent credit activity</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="py-8 text-center text-gray-500">
                                <TrendingUp className="mx-auto mb-4 h-12 w-12 opacity-50" />
                                <p>No transactions yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {transactions.map((transaction) => (
                                    <div
                                        key={transaction.id}
                                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-full bg-white p-2">
                                                {getTransactionIcon(transaction.type)}
                                            </div>
                                            <div>
                                                <p className="font-medium">{getTransactionTypeLabel(transaction.type)}</p>
                                                <p className="text-sm text-gray-500">{transaction.description}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(transaction.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
