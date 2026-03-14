import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { subscriptionApi, paymentsApi, SubscriptionDetails, SubscriptionPlan } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const SubscriptionPage = () => {
    const { refreshUser } = useAuth();
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [subData, plansData] = await Promise.all([
                    subscriptionApi.getSubscription(),
                    subscriptionApi.getPublicPlans(),
                ]);

                setSubscription(subData);
                setPlans(plansData.plans || []);
            } catch (err) {
                console.error('Failed to load subscription data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel your subscription?')) return;

        setProcessing(true);
        try {
            const result = await subscriptionApi.cancel();
            setSubscription(result.subscription);
            toast({
                title: 'Subscription cancelled',
                description: 'Your subscription has been cancelled. You can continue using it until the end of your billing period.',
            });
            refreshUser();
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to cancel subscription',
                variant: 'destructive',
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleReactivate = async () => {
        setProcessing(true);
        try {
            const result = await subscriptionApi.reactivate();
            setSubscription(result.subscription);
            toast({
                title: 'Subscription reactivated',
                description: 'Your subscription has been reactivated.',
            });
            refreshUser();
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to reactivate subscription',
                variant: 'destructive',
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleChangePlan = async (planId: string) => {
        setProcessing(true);
        try {
            const result = await subscriptionApi.subscribe(planId);
            if (result.url) {
                window.location.href = result.url;
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to change plan',
                variant: 'destructive',
            });
            setProcessing(false);
        }
    };

    const handleManageBilling = async () => {
        setProcessing(true);
        try {
            const result = await paymentsApi.getPortalUrl();
            if (result.url) {
                window.location.href = result.url;
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to open billing portal',
                variant: 'destructive',
            });
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Subscription Management</h1>

            {subscription ? (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>{subscription.planName || 'Current Plan'}</CardTitle>
                                    <CardDescription>
                                        {subscription.status === 'active' && 'Your subscription is active'}
                                        {subscription.status === 'trial' && 'You are on a free trial'}
                                        {subscription.status === 'past_due' && 'Payment overdue - please update your payment method'}
                                        {subscription.status === 'canceled' && 'Subscription cancelled'}
                                        {subscription.cancelAtPeriodEnd && ' - Ends at billing period end'}
                                    </CardDescription>
                                </div>
                                <Badge variant={
                                    subscription.status === 'active' ? 'default' :
                                        subscription.status === 'trial' ? 'secondary' :
                                            subscription.status === 'past_due' ? 'destructive' :
                                                'outline'
                                }>
                                    {subscription.status}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Credits Remaining</p>
                                    <p className="text-2xl font-bold">{subscription.creditsRemaining}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Monthly Credits</p>
                                    <p className="text-2xl font-bold">{subscription.monthlyCredits}</p>
                                </div>
                                {subscription.currentPeriodEnd && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Next Billing Date</p>
                                        <p className="text-lg font-medium">
                                            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-muted-foreground">Credits Used This Period</p>
                                    <p className="text-lg font-medium">{subscription.creditsUsedThisPeriod}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-4">
                                {subscription.status === 'canceled' || subscription.cancelAtPeriodEnd ? (
                                    <Button onClick={handleReactivate} disabled={processing}>
                                        Reactivate Subscription
                                    </Button>
                                ) : (
                                    <Button variant="outline" onClick={handleCancel} disabled={processing}>
                                        Cancel Subscription
                                    </Button>
                                )}
                                <Button variant="outline" onClick={handleManageBilling} disabled={processing}>
                                    Manage Billing
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Available Plans</CardTitle>
                            <CardDescription>Upgrade or change your plan at any time</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {plans.map((plan) => (
                                    <Card
                                        key={plan.id}
                                        className={`cursor-pointer transition-all ${plan.id === subscription.planId
                                                ? 'ring-2 ring-primary'
                                                : 'hover:border-primary/50'
                                            }`}
                                        onClick={() => plan.id !== subscription.planId && handleChangePlan(plan.id)}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg">{plan.name}</CardTitle>
                                                {plan.isPopular && (
                                                    <Badge variant="secondary">Popular</Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">
                                                ${plan.price}
                                                <span className="text-sm font-normal text-muted-foreground">
                                                    /{plan.billingInterval}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {plan.monthlyCredits} credits/month
                                            </p>
                                            {plan.id === subscription.planId && (
                                                <Badge className="mt-2">Current</Badge>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground mb-4">You don't have an active subscription</p>
                        <Button onClick={() => setLocation('/pricing')}>
                            View Plans
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default SubscriptionPage;
