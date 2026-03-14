import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { subscriptionApi, creditsApi, paymentsApi, SubscriptionPlan, CreditPackage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const PricingPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTab, setSelectedTab] = useState('subscriptions');
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [plansData, packagesData] = await Promise.all([
                    subscriptionApi.getPublicPlans(),
                    creditsApi.getPackages(),
                ]);

                setPlans(plansData.plans || []);
                setPackages(packagesData.packages || []);
            } catch (err) {
                console.error('Failed to load pricing data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load pricing data');
                toast({
                    title: 'Error',
                    description: 'Failed to load pricing information',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const handleSubscribe = async (planId: string) => {
        if (!user) {
            setLocation('/auth');
            return;
        }

        setProcessingId(planId);
        try {
            const response = await subscriptionApi.subscribe(planId);
            if (response.url) {
                window.location.href = response.url;
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to subscribe',
                variant: 'destructive',
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handlePurchase = async (packageId: string) => {
        if (!user) {
            setLocation('/auth');
            return;
        }

        setProcessingId(packageId);
        try {
            const response = await paymentsApi.createCheckout(packageId);
            if (response.url) {
                window.location.href = response.url;
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to purchase credits',
                variant: 'destructive',
            });
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="text-center py-12">
                    <p className="text-red-500">{error}</p>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setError(null);
                            setLoading(true);
                        }}
                        className="mt-4"
                    >
                        Try again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold">Simple, Transparent Pricing</h1>
                <p className="text-muted-foreground mt-2">
                    The product is in validation, so only the starter offer is available right now.
                </p>
            </div>

            {plans.length === 0 && packages.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No plans available at the moment.</p>
                </div>
            ) : packages.length === 0 ? (
                /* Only subscription plans exist — no tabs needed */
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
                    {plans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={`relative ${user?.subscriptionPlanId === plan.id ? 'ring-2 ring-primary' : ''}`}
                        >
                            {plan.isPopular && (
                                <Badge className="absolute -top-2 right-4">Popular</Badge>
                            )}
                            <CardHeader>
                                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                                {plan.description && (
                                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-4">
                                    <div className="text-4xl font-bold">
                                        ${plan.price}
                                        <span className="text-lg font-normal text-muted-foreground">
                                            /{plan.billingInterval}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-muted-foreground">Monthly Credits</p>
                                        <p className="text-2xl font-bold">{plan.monthlyCredits}</p>
                                    </div>
                                    <ul className="text-sm text-muted-foreground space-y-2">
                                        <li>Manual purchase: {plan.allowManualPurchase ? 'Yes' : 'No'}</li>
                                        <li>Rollover: {plan.allowRollover ? 'Yes' : 'No'}</li>
                                        {plan.trialDays && <li>Free trial: {plan.trialDays} days</li>}
                                    </ul>
                                </div>
                                <Button
                                    className="w-full mt-6"
                                    onClick={() => handleSubscribe(plan.id)}
                                    disabled={processingId === plan.id || user?.subscriptionPlanId === plan.id}
                                >
                                    {processingId === plan.id
                                        ? 'Processing...'
                                        : user?.subscriptionPlanId === plan.id
                                            ? 'Current Plan'
                                            : 'Get Started'}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                /* Both plans and packages exist — show tabs */
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                    <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                        <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                        <TabsTrigger value="credits">Offer</TabsTrigger>
                    </TabsList>

                    <TabsContent value="subscriptions" className="mt-6">
                        {plans.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">No plans available</p>
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {plans.map((plan) => (
                                    <Card
                                        key={plan.id}
                                        className={`relative ${user?.subscriptionPlanId === plan.id ? 'ring-2 ring-primary' : ''}`}
                                    >
                                        {plan.isPopular && (
                                            <Badge className="absolute -top-2 right-4">Popular</Badge>
                                        )}
                                        <CardHeader>
                                            <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                                            {plan.description && (
                                                <p className="text-sm text-muted-foreground">{plan.description}</p>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-center py-4">
                                                <div className="text-4xl font-bold">
                                                    ${plan.price}
                                                    <span className="text-lg font-normal text-muted-foreground">
                                                        /{plan.billingInterval}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="text-center">
                                                    <p className="text-sm font-medium text-muted-foreground">Monthly Credits</p>
                                                    <p className="text-2xl font-bold">{plan.monthlyCredits}</p>
                                                </div>
                                                <ul className="text-sm text-muted-foreground space-y-2">
                                                    <li>Manual purchase: {plan.allowManualPurchase ? 'Yes' : 'No'}</li>
                                                    <li>Rollover: {plan.allowRollover ? 'Yes' : 'No'}</li>
                                                    {plan.trialDays && <li>Free trial: {plan.trialDays} days</li>}
                                                </ul>
                                            </div>
                                            <Button
                                                className="w-full mt-6"
                                                onClick={() => handleSubscribe(plan.id)}
                                                disabled={processingId === plan.id || user?.subscriptionPlanId === plan.id}
                                            >
                                                {processingId === plan.id
                                                    ? 'Processing...'
                                                    : user?.subscriptionPlanId === plan.id
                                                        ? 'Current Plan'
                                                        : 'Get Started'}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="credits" className="mt-6">
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {packages.map((pkg) => (
                                <Card key={pkg.id} className="relative">
                                    {pkg.isPopular && (
                                        <Badge className="absolute -top-2 right-4">Best Value</Badge>
                                    )}
                                    <CardHeader>
                                        <CardTitle className="text-xl font-bold">{pkg.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-center py-4">
                                            <div className="text-3xl font-bold">${pkg.price}</div>
                                            <p className="text-sm text-muted-foreground mt-2">
                                                ${(parseFloat(pkg.price) / pkg.credits).toFixed(3)} per credit
                                            </p>
                                        </div>
                                        {pkg.description && (
                                            <p className="text-sm text-muted-foreground text-center">
                                                {pkg.description}
                                            </p>
                                        )}
                                        <Button
                                            className="w-full mt-6"
                                            onClick={() => handlePurchase(pkg.id)}
                                            disabled={processingId === pkg.id}
                                        >
                                            {processingId === pkg.id ? 'Processing...' : 'Purchase'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
};

export default PricingPage;
