import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
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

    // Check URL params for payment success/cancel
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
                    // Clean up URL
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
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [toast, refreshUser, queryClient]);

    // Fetch credit packages from Stripe
    const { data: packagesData } = useQuery({
        queryKey: ['credit-packages'],
        queryFn: () => paymentsApi.getPackages(),
    });

    // Fetch transaction history
    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ['credit-history'],
        queryFn: () => creditsApi.getHistory(1, 20),
    });

    // Create Stripe checkout session
    const checkoutMutation = useMutation({
        mutationFn: (packageId: string) => paymentsApi.createCheckout(packageId),
        onSuccess: (data) => {
            // Redirect to Stripe Checkout
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
                return <ArrowUpRight className="w-4 h-4 text-green-600" />;
            case 'usage':
                return <ArrowDownRight className="w-4 h-4 text-red-600" />;
            case 'refund':
                return <ArrowUpRight className="w-4 h-4 text-blue-600" />;
            default:
                return <Coins className="w-4 h-4" />;
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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">💰</span>
                        <h1 className="text-xl font-bold text-gray-900">Credits</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Coins className="w-4 h-4 text-green-600" />
                            <span className="font-medium">{user?.credits ?? 0} credits</span>
                        </div>
                        <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Current Balance */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                        <CardContent className="p-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm">Current Balance</p>
                                    <p className="text-5xl font-bold mt-2">{user?.credits ?? 0}</p>
                                    <p className="text-blue-100 mt-2">credits available</p>
                                </div>
                                <div className="p-4 bg-white/10 rounded-full">
                                    <Coins className="w-16 h-16" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Payment Verification Overlay */}
                {verifyingPayment && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    >
                        <Card className="w-full max-w-md mx-4">
                            <CardContent className="p-8 text-center">
                                <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
                                <h3 className="text-xl font-bold mb-2">Verifying Payment...</h3>
                                <p className="text-gray-500">Please wait while we confirm your payment.</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Credit Packages */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8"
                >
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Purchase Credits</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {packages.map((pkg, index) => (
                            <motion.div
                                key={pkg.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + index * 0.05 }}
                            >
                                <Card className={`relative overflow-hidden hover:shadow-lg transition-shadow ${pkg.isPopular ? 'ring-2 ring-primary' : ''}`}>
                                    {pkg.isPopular && (
                                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1">
                                            Most Popular
                                        </div>
                                    )}
                                    <CardHeader className="text-center pb-2">
                                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                                        <div className="mt-2">
                                            <span className="text-3xl font-bold">${pkg.price}</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="text-center">
                                        <p className="text-2xl font-bold text-primary mb-2">{pkg.credits} credits</p>
                                        {pkg.description && (
                                            <p className="text-sm text-gray-600 mb-2">{pkg.description}</p>
                                        )}
                                        <p className="text-sm text-gray-500 mb-4">
                                            ${(parseFloat(pkg.price) / pkg.credits).toFixed(3)} per credit
                                        </p>
                                        <Button
                                            className="w-full"
                                            onClick={() => handlePurchase(pkg.id)}
                                            disabled={purchasingPackage !== null}
                                        >
                                            {purchasingPackage === pkg.id ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

                {/* Transaction History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" />
                                Transaction History
                            </CardTitle>
                            <CardDescription>Your recent credit activity</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : transactions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No transactions yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {transactions.map((transaction) => (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-full">
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
            </main>
        </div>
    );
}
