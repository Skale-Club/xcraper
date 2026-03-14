import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    Calendar,
    CheckCircle2,
    Coins,
    CreditCard,
    ExternalLink,
    Loader2,
    TrendingUp,
    Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, creditsApi, paymentsApi, subscriptionApi, type CreditTransaction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function isValidMoney(value: string): boolean {
    return /^\d+(\.\d{1,2})?$/.test(value);
}

export default function BillingPage() {
    const { user, refreshUser } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [, setLocation] = useLocation();

    const [verifyingPayment, setVerifyingPayment] = useState(false);
    const [syncingSubscription, setSyncingSubscription] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [savingTopUp, setSavingTopUp] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [topUpEnabled, setTopUpEnabled] = useState(false);
    const [topUpThreshold, setTopUpThreshold] = useState('50');
    const [monthlyCap, setMonthlyCap] = useState('20.00');

    useEffect(() => {
        if (user?.role === 'admin') {
            setLocation('/dashboard');
            toast({
                title: 'Admin Access',
                description: 'Admins have unlimited access and do not need billing controls.',
            });
        }
    }, [setLocation, toast, user]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');
        const checkoutStatus = params.get('checkout');
        const sessionId = params.get('session_id');

        if (checkoutStatus === 'success' && sessionId) {
            setSyncingSubscription(true);
            subscriptionApi.verifyCheckout(sessionId)
                .then(async (data) => {
                    await refreshUser();
                    queryClient.invalidateQueries({ queryKey: ['credit-balance'] });
                    queryClient.invalidateQueries({ queryKey: ['credit-history'] });
                    queryClient.invalidateQueries({ queryKey: ['subscription'] });
                    setActionError(null);
                    toast({
                        title: 'Subscription active',
                        description: data.creditsGranted > 0
                            ? `${data.creditsGranted} credits were added to your plan.`
                            : 'Your subscription is now active.',
                    });
                    window.history.replaceState({}, '', window.location.pathname);
                })
                .catch((error: Error) => {
                    const message = error instanceof ApiError ? error.message : 'Subscription verification failed';
                    setActionError(message);
                    toast({ variant: 'destructive', title: 'Error', description: message });
                })
                .finally(() => setSyncingSubscription(false));
        } else if (checkoutStatus === 'canceled') {
            toast({
                variant: 'destructive',
                title: 'Checkout canceled',
                description: 'Your subscription checkout was canceled.',
            });
            window.history.replaceState({}, '', window.location.pathname);
        } else if (paymentStatus === 'success' && sessionId) {
            setVerifyingPayment(true);
            paymentsApi.verifyPayment(sessionId)
                .then(async (data) => {
                    await refreshUser();
                    queryClient.invalidateQueries({ queryKey: ['credit-balance'] });
                    queryClient.invalidateQueries({ queryKey: ['credit-history'] });
                    setActionError(null);
                    toast({
                        title: 'Payment Successful',
                        description: `${data.credits} credits have been added to your account.`,
                    });
                    window.history.replaceState({}, '', window.location.pathname);
                })
                .catch((error: Error) => {
                    const message = error instanceof ApiError ? error.message : 'Payment verification failed';
                    setActionError(message);
                    toast({ variant: 'destructive', title: 'Error', description: message });
                })
                .finally(() => setVerifyingPayment(false));
        } else if (paymentStatus === 'canceled') {
            toast({
                variant: 'destructive',
                title: 'Payment Cancelled',
                description: 'Your payment was cancelled. Please try again.',
            });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [queryClient, refreshUser, toast]);

    const { data: balanceData } = useQuery({
        queryKey: ['credit-balance'],
        queryFn: () => creditsApi.getBalance(),
    });

    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ['credit-history'],
        queryFn: () => creditsApi.getHistory(1, 20),
    });

    const { data: subscription, isLoading: subscriptionLoading } = useQuery({
        queryKey: ['subscription'],
        queryFn: () => subscriptionApi.getSubscription(),
        retry: false,
    });

    const { data: plansData, isLoading: plansLoading } = useQuery({
        queryKey: ['subscription-plans'],
        queryFn: () => subscriptionApi.getPublicPlans(),
    });

    const activePlanCount = plansData?.plans.length ?? 0;
    const visiblePlans = (plansData?.plans ?? []).slice(0, 1);
    const currentPlan =
        (plansData?.plans ?? []).find((plan) => plan.id === (subscription?.planId ?? user?.subscriptionPlanId)) ??
        visiblePlans[0];
    const isPaidCustomer =
        Boolean(subscription && subscription.status !== 'canceled') ||
        Boolean(user?.subscriptionPlanId && user.subscriptionStatus !== 'canceled');
    const availableCredits = balanceData?.credits ?? user?.totalCredits ?? user?.credits ?? 0;
    const topUpSpend = user?.currentMonthTopUpSpend ?? '0.00';
    const topUpAvailable = Boolean(
        isPaidCustomer &&
        (currentPlan?.allowOverage ?? true) &&
        (currentPlan?.allowAutoTopUp ?? true),
    );
    const canChangePlan = isPaidCustomer && activePlanCount > 1;

    useEffect(() => {
        if (!isPaidCustomer) {
            setTopUpEnabled(false);
            setTopUpThreshold(String(currentPlan?.topUpThreshold ?? 50));
            setMonthlyCap(currentPlan?.defaultMonthlyTopUpCap ?? '20.00');
            return;
        }

        setTopUpEnabled(Boolean(user?.autoTopUpEnabled));
        setTopUpThreshold(String(user?.topUpThreshold ?? currentPlan?.topUpThreshold ?? 50));
        setMonthlyCap(user?.monthlyTopUpCap ?? currentPlan?.defaultMonthlyTopUpCap ?? '20.00');
    }, [
        currentPlan?.defaultMonthlyTopUpCap,
        currentPlan?.topUpThreshold,
        isPaidCustomer,
        user?.autoTopUpEnabled,
        user?.monthlyTopUpCap,
        user?.topUpThreshold,
    ]);

    const handleManageBilling = async () => {
        setActionError(null);
        setProcessing(true);
        try {
            const result = await subscriptionApi.getPortalUrl();
            if (!result.url) {
                throw new Error('Stripe billing portal URL was not returned by the server');
            }
            window.location.assign(result.url);
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to open billing portal';
            setActionError(message);
            toast({ title: 'Error', description: message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleSubscribe = async (planId: string) => {
        setActionError(null);
        setProcessing(true);
        try {
            const result = await subscriptionApi.subscribe(planId);
            if (!result.url) {
                throw new Error('Stripe subscription checkout URL was not returned by the server');
            }
            window.location.assign(result.url);
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to start subscription';
            setActionError(message);
            toast({ title: 'Error', description: message, variant: 'destructive' });
        } finally {
            setProcessing(false);
        }
    };

    const handleSaveTopUp = async () => {
        const parsedThreshold = Number.parseInt(topUpThreshold, 10);
        const normalizedCap = monthlyCap.trim();

        if (Number.isNaN(parsedThreshold) || parsedThreshold < 0) {
            const message = 'Threshold must be a non-negative number.';
            setActionError(message);
            toast({ title: 'Invalid threshold', description: message, variant: 'destructive' });
            return;
        }

        if (!isValidMoney(normalizedCap)) {
            const message = 'Monthly cap must be a valid amount, for example 20 or 20.00.';
            setActionError(message);
            toast({ title: 'Invalid cap', description: message, variant: 'destructive' });
            return;
        }

        setActionError(null);
        setSavingTopUp(true);
        try {
            await subscriptionApi.updateAutoTopUp({
                enabled: topUpEnabled,
                threshold: parsedThreshold,
                monthlyCap: normalizedCap,
            });
            await refreshUser();
            queryClient.invalidateQueries({ queryKey: ['subscription'] });
            toast({
                title: 'Top up settings saved',
                description: 'Overage controls were updated successfully.',
            });
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to save top up settings';
            setActionError(message);
            toast({ title: 'Error', description: message, variant: 'destructive' });
        } finally {
            setSavingTopUp(false);
        }
    };

    const getTransactionIcon = (type: CreditTransaction['type']) => {
        switch (type) {
            case 'purchase':
            case 'top_up':
            case 'bonus':
                return <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
            case 'usage':
                return <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />;
            case 'refund':
                return <ArrowUpRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
            default:
                return <Coins className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const transactions = historyData?.transactions ?? [];

    return (
        <div className="w-full space-y-6">
            {/* Payment verification overlay */}
            {(verifyingPayment || syncingSubscription) && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                >
                    <Card className="mx-4 w-full max-w-md">
                        <CardContent className="flex flex-col items-center p-8 text-center">
                            <Loader2 className="mb-6 h-12 w-12 animate-spin text-primary" />
                            <h3 className="mb-2 text-xl font-bold text-foreground">
                                {syncingSubscription ? 'Syncing Subscription...' : 'Verifying Payment...'}
                            </h3>
                            <p className="text-muted-foreground">
                                {syncingSubscription
                                    ? 'Please wait while your subscription and credits are synchronized.'
                                    : 'Please wait while the transaction is confirmed.'}
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Error banner */}
            {actionError && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="flex items-start gap-3 p-4 text-sm">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div>
                            <p className="font-medium text-foreground">Billing action failed</p>
                            <p className="text-muted-foreground">{actionError}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Balance + Plan summary row */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 gap-4 lg:grid-cols-3"
            >
                {/* Credit balance card */}
                <Card className="lg:col-span-2">
                    <CardContent className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Available Balance</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black tracking-tight text-foreground">{availableCredits}</span>
                                <span className="text-lg font-medium text-muted-foreground">credits</span>
                            </div>
                            {isPaidCustomer && subscription && (
                                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                    <Zap className="h-3.5 w-3.5 text-primary" />
                                    <span>
                                        On <strong className="text-foreground">{subscription.planName}</strong>
                                        {subscription.cancelAtPeriodEnd && (
                                            <Badge variant="outline" className="ml-2 text-xs">Cancelling</Badge>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                            {(user?.stripeCustomerId || subscription) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={handleManageBilling}
                                    disabled={processing}
                                >
                                    <CreditCard className="mr-2 h-3.5 w-3.5" />
                                    Manage Billing
                                </Button>
                            )}
                            {canChangePlan && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={handleManageBilling}
                                    disabled={processing}
                                >
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                    Change Plan
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick stats card */}
                {isPaidCustomer && subscription ? (
                    <Card>
                        <CardContent className="flex h-full flex-col justify-center gap-4 p-6">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">This Cycle</p>
                                <p className="mt-1 text-2xl font-bold text-foreground">{subscription.creditsUsedThisPeriod} <span className="text-sm font-normal text-muted-foreground">used</span></p>
                            </div>
                            <div className="h-px bg-border" />
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {subscription.cancelAtPeriodEnd ? 'Access Ends' : 'Renews'}
                                </p>
                                <p className="mt-1 text-sm font-medium text-foreground">
                                    {subscription.currentPeriodEnd
                                        ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                        : '—'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                            <Coins className="h-6 w-6 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">No active plan</p>
                        </CardContent>
                    </Card>
                )}
            </motion.div>

            {/* Plan / Offer section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
            >
                {!isPaidCustomer ? (
                    plansLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : visiblePlans.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="py-12 text-center text-muted-foreground">
                                No plan offer is available at the moment.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:max-w-lg">
                            {visiblePlans.map((plan) => (
                                <Card key={plan.id} className="relative overflow-hidden border-primary/30 bg-primary/5">
                                    <div className="absolute right-4 top-4">
                                        <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                                            Validation Offer
                                        </Badge>
                                    </div>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                                        {plan.description && (
                                            <CardDescription className="pt-1">{plan.description}</CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-5">
                                        <div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-bold tracking-tight text-foreground">${plan.price}</span>
                                                <span className="text-sm text-muted-foreground">/mo</span>
                                            </div>
                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center text-sm">
                                                    <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                    <span className="font-medium text-foreground">{plan.monthlyCredits} credits per month</span>
                                                </div>
                                                <div className="flex items-center text-sm text-muted-foreground">
                                                    <CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground/50" />
                                                    Overage control with top up limits
                                                </div>
                                                {plan.allowRollover && (
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground/50" />
                                                        Rollover enabled
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full"
                                            type="button"
                                            onClick={() => void handleSubscribe(plan.id)}
                                            disabled={processing}
                                        >
                                            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Plan'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )
                ) : subscriptionLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : subscription ? (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Plan Details</CardTitle>
                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
                                    {subscription.cancelAtPeriodEnd ? 'Cancelling' : 'Active'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monthly Credits</p>
                                    <p className="mt-1.5 text-2xl font-bold text-foreground">{subscription.monthlyCredits}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Used This Cycle</p>
                                    <p className="mt-1.5 text-2xl font-bold text-foreground">{subscription.creditsUsedThisPeriod}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Remaining</p>
                                    <p className="mt-1.5 text-2xl font-bold text-foreground">{subscription.creditsRemaining}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}
            </motion.div>

            {/* Top Up section */}
            {isPaidCustomer && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Top Up</CardTitle>
                                    <CardDescription>
                                        {topUpAvailable
                                            ? 'Automatic credit replenishment when your balance is low.'
                                            : 'This plan does not currently allow automatic top up.'}
                                    </CardDescription>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={topUpEnabled ? 'default' : 'outline'}
                                    onClick={() => setTopUpEnabled((current) => !current)}
                                    disabled={!topUpAvailable || savingTopUp}
                                >
                                    {topUpEnabled ? 'Enabled' : 'Disabled'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="rounded-lg border border-border bg-muted/20 p-4">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">
                                        {currentPlan?.defaultTopUpCredits && currentPlan?.defaultTopUpPrice
                                            ? `When triggered, ${currentPlan.defaultTopUpCredits} credits are added for $${currentPlan.defaultTopUpPrice}.`
                                            : 'When triggered, extra credits are added automatically.'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Spent this month: ${topUpSpend}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground" htmlFor="topup-cap">
                                        Monthly limit ($)
                                    </label>
                                    <Input
                                        id="topup-cap"
                                        inputMode="decimal"
                                        value={monthlyCap}
                                        onChange={(event) => setMonthlyCap(event.target.value)}
                                        disabled={!topUpAvailable || savingTopUp}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Maximum extra amount charged this month.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground" htmlFor="topup-threshold">
                                        Trigger at (credits)
                                    </label>
                                    <Input
                                        id="topup-threshold"
                                        type="number"
                                        min="0"
                                        value={topUpThreshold}
                                        onChange={(event) => setTopUpThreshold(event.target.value)}
                                        disabled={!topUpAvailable || savingTopUp}
                                    />
                                    <p className="text-xs text-muted-foreground">Top up when remaining credits reach this number.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button type="button" onClick={() => void handleSaveTopUp()} disabled={!topUpAvailable || savingTopUp}>
                                    {savingTopUp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Transaction history */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <Card>
                    <CardHeader className="border-b border-border pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <TrendingUp className="h-5 w-5 text-muted-foreground" />
                            Transaction History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="flex flex-col items-center py-16 text-center">
                                <div className="mb-4 rounded-full bg-muted p-4">
                                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">No transactions yet</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Your purchase and usage history will appear here.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {transactions.map((transaction) => (
                                    <div
                                        key={transaction.id}
                                        className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/30"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50">
                                                {getTransactionIcon(transaction.type)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium capitalize text-foreground">
                                                    {transaction.type.replace('_', ' ')}
                                                </p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{transaction.description}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-semibold ${transaction.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                                                {transaction.amount > 0 ? '+' : ''}
                                                {transaction.amount}
                                            </p>
                                            <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(transaction.createdAt).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
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
