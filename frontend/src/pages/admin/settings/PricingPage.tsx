import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { settingsApi, subscriptionApi, ApiError, AdminCreditPackage, AdminSubscriptionPlan } from '@/lib/api';
import {
    Loader2,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Star,
    Coins,
    Zap,
    Users,
} from 'lucide-react';

export default function PricingPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['admin-settings'],
        queryFn: () => settingsApi.getAdmin(),
    });

    const packages: AdminCreditPackage[] = data?.packages ?? [];

    const { data: plansData } = useQuery({
        queryKey: ['admin-subscription-plans'],
        queryFn: () => subscriptionApi.getAdminPlans(),
    });

    const subscriptionPlans: AdminSubscriptionPlan[] = plansData?.plans ?? [];

    const createPackageMutation = useMutation({
        mutationFn: (data: Parameters<typeof settingsApi.createPackage>[0]) =>
            settingsApi.createPackage(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package created successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to create package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const deletePackageMutation = useMutation({
        mutationFn: (id: string) => settingsApi.deletePackage(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package deleted successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to delete package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const updatePackageMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof settingsApi.updatePackage>[1] }) =>
            settingsApi.updatePackage(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            toast({ title: 'Package updated successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to update package';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const updatePlanMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<AdminSubscriptionPlan> }) =>
            subscriptionApi.updatePlan(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
            toast({ title: 'Plan updated successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to update plan';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const deletePlanMutation = useMutation({
        mutationFn: (id: string) => subscriptionApi.deletePlan(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
            toast({ title: 'Plan deleted successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to delete plan';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="border-border">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Subscription Plans</CardTitle>
                            <CardDescription>Manage subscription plans visible to users</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                {subscriptionPlans.filter(p => p.isActive).length} active
                            </div>
                            <span className="opacity-40">|</span>
                            <div className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                                {subscriptionPlans.filter(p => !p.isActive).length} hidden
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {subscriptionPlans
                            .sort((a, b) => a.displayOrder - b.displayOrder)
                            .map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                                        plan.isActive
                                            ? 'border-border bg-card'
                                            : 'border-border/50 bg-muted/30 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                                plan.isActive
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}>
                                                <Zap className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-foreground truncate">{plan.name}</p>
                                                    {!plan.isActive && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                            <EyeOff className="h-2.5 w-2.5" />
                                                            Hidden
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-sm text-muted-foreground">
                                                    <span className="font-medium text-foreground">{plan.monthlyCredits}</span> credits/mo
                                                    <span className="mx-1.5 opacity-40">&middot;</span>
                                                    <span className="font-medium text-foreground">${plan.price}</span>/{plan.billingInterval === 'yearly' ? 'yr' : 'mo'}
                                                    {plan.subscriberCount > 0 && (
                                                        <>
                                                            <span className="mx-1.5 opacity-40">&middot;</span>
                                                            <span className="inline-flex items-center gap-1">
                                                                <Users className="inline h-3 w-3" />
                                                                {plan.subscriberCount}
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                title={plan.isActive ? 'Hide from users' : 'Show to users'}
                                                onClick={() => updatePlanMutation.mutate({
                                                    id: plan.id,
                                                    data: { isActive: !plan.isActive },
                                                })}
                                            >
                                                {plan.isActive ? (
                                                    <Eye className="h-3.5 w-3.5" />
                                                ) : (
                                                    <EyeOff className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                title={plan.subscriberCount > 0 ? 'Cannot delete plan with subscribers' : 'Delete plan'}
                                                disabled={plan.subscriberCount > 0}
                                                onClick={() => deletePlanMutation.mutate(plan.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                        {subscriptionPlans.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="rounded-full bg-muted p-3 mb-3">
                                    <Zap className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium text-foreground">No subscription plans yet</p>
                                <p className="mt-1 text-xs text-muted-foreground">Subscription plans are created via Stripe integration.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Credit Packages</CardTitle>
                            <CardDescription>Manage one-time credit packages for purchase</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                {packages.filter(p => p.isActive).length} active
                            </div>
                            <span className="opacity-40">|</span>
                            <div className="flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                                {packages.filter(p => !p.isActive).length} hidden
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {packages
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((pkg) => (
                                <div
                                    key={pkg.id}
                                    className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                                        pkg.isActive
                                            ? 'border-border bg-card'
                                            : 'border-border/50 bg-muted/30 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                                pkg.isActive
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}>
                                                <Coins className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-foreground truncate">{pkg.name}</p>
                                                    {pkg.isPopular && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                                            <Star className="h-2.5 w-2.5 fill-current" />
                                                            Popular
                                                        </span>
                                                    )}
                                                    {!pkg.isActive && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                            <EyeOff className="h-2.5 w-2.5" />
                                                            Hidden
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-sm text-muted-foreground">
                                                    <span className="font-medium text-foreground">{pkg.credits}</span> credits
                                                    <span className="mx-1.5 opacity-40">&middot;</span>
                                                    <span className="font-medium text-foreground">${pkg.price}</span>
                                                    {pkg.description && (
                                                        <>
                                                            <span className="mx-1.5 opacity-40">&middot;</span>
                                                            <span className="text-muted-foreground">{pkg.description}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                title={pkg.isPopular ? 'Remove popular badge' : 'Mark as popular'}
                                                onClick={() => updatePackageMutation.mutate({
                                                    id: pkg.id,
                                                    data: { isPopular: !pkg.isPopular },
                                                })}
                                            >
                                                <Star className={`h-3.5 w-3.5 ${pkg.isPopular ? 'fill-amber-500 text-amber-500' : ''}`} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                title={pkg.isActive ? 'Hide from users' : 'Show to users'}
                                                onClick={() => updatePackageMutation.mutate({
                                                    id: pkg.id,
                                                    data: { isActive: !pkg.isActive },
                                                })}
                                            >
                                                {pkg.isActive ? (
                                                    <Eye className="h-3.5 w-3.5" />
                                                ) : (
                                                    <EyeOff className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                title="Delete package"
                                                onClick={() => deletePackageMutation.mutate(pkg.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                        {packages.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="rounded-full bg-muted p-3 mb-3">
                                    <Coins className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium text-foreground">No packages yet</p>
                                <p className="mt-1 text-xs text-muted-foreground">Create your first credit package below.</p>
                            </div>
                        )}

                        <Button
                            variant="outline"
                            className="w-full border-dashed"
                            onClick={() => {
                                createPackageMutation.mutate({
                                    name: 'New Package',
                                    credits: 100,
                                    price: '9.99',
                                    sortOrder: packages.length,
                                });
                            }}
                            disabled={createPackageMutation.isPending}
                        >
                            {createPackageMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="mr-2 h-4 w-4" />
                            )}
                            Add Package
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
