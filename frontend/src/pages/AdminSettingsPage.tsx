import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUpload } from '@/components/ui/file-upload';
import { useToast } from '@/hooks/use-toast';
import { settingsApi, subscriptionApi, uploadApi, ApiError, AdminSettings, AdminCreditPackage, AdminSubscriptionPlan } from '@/lib/api';
import {
    Loader2,
    Plus,
    Trash2,
    Globe,
    Palette,
    DollarSign,
    Cpu,
    Settings as SettingsIcon,
    Eye,
    EyeOff,
    Star,
    Coins,
    Zap,
    Users,
} from 'lucide-react';

type SettingsTab = 'branding' | 'seo' | 'content' | 'pricing' | 'advanced';

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<SettingsTab>('branding');

    const { data, isLoading } = useQuery({
        queryKey: ['admin-settings'],
        queryFn: () => settingsApi.getAdmin(),
    });

    const settings: Partial<AdminSettings> = data?.settings ?? {};
    const packages: AdminCreditPackage[] = data?.packages ?? [];

    const updateMutation = useMutation({
        mutationFn: (data: Partial<AdminSettings>) => settingsApi.update(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
            queryClient.invalidateQueries({ queryKey: ['public-settings'] });
            toast({ title: 'Settings saved successfully!' });
        },
        onError: (error: Error) => {
            const message = error instanceof ApiError ? error.message : 'Failed to save settings';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

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

    const { data: plansData } = useQuery({
        queryKey: ['admin-subscription-plans'],
        queryFn: () => subscriptionApi.getAdminPlans(),
    });

    const subscriptionPlans: AdminSubscriptionPlan[] = plansData?.plans ?? [];

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

    const handleSave = (data: Partial<AdminSettings>) => {
        updateMutation.mutate(data);
    };

    const optionalValue = (value: string) => value || undefined;

    const tabs: { id: SettingsTab; label: string; icon: typeof Globe }[] = [
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'seo', label: 'SEO', icon: Globe },
        { id: 'content', label: 'Content', icon: SettingsIcon },
        { id: 'pricing', label: 'Pricing', icon: DollarSign },
        { id: 'advanced', label: 'Advanced', icon: Cpu },
    ];

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="w-full space-y-8">
            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="lg:w-64 lg:flex-shrink-0">
                    <Card className="border-border">
                        <CardContent className="p-2">
                            <nav className="space-y-1">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-slate-700 dark:text-white hover:bg-muted hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                    >
                                        <tab.icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex-1">
                    {activeTab === 'branding' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Branding Settings</CardTitle>
                                <CardDescription>Customize your brand identity</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="brandName">Brand Name</Label>
                                        <Input
                                            id="brandName"
                                            defaultValue={settings.brandName}
                                            onBlur={(e) => handleSave({ brandName: e.target.value })}
                                            placeholder="Xcraper"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="brandTagline">Tagline</Label>
                                        <Input
                                            id="brandTagline"
                                            defaultValue={settings.brandTagline}
                                            onBlur={(e) => handleSave({ brandTagline: e.target.value })}
                                            placeholder="Extract Business Contacts from Google Maps"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="brandDescription">Brand Description</Label>
                                    <Input
                                        id="brandDescription"
                                        defaultValue={settings.brandDescription}
                                        onBlur={(e) => handleSave({ brandDescription: e.target.value })}
                                        placeholder="The most powerful Google Maps scraping tool..."
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Logo</Label>
                                        <FileUpload
                                            currentUrl={settings.logoUrl}
                                            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
                                            maxSize={5 * 1024 * 1024}
                                            onUpload={async (file) => {
                                                const result = await uploadApi.uploadLogo(file);
                                                handleSave({ logoUrl: result.url });
                                            }}
                                            onDelete={async () => {
                                                await uploadApi.deleteLogo();
                                                handleSave({ logoUrl: undefined });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Favicon</Label>
                                        <FileUpload
                                            currentUrl={settings.faviconUrl}
                                            accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                                            maxSize={1 * 1024 * 1024}
                                            onUpload={async (file) => {
                                                const result = await uploadApi.uploadFavicon(file);
                                                handleSave({ faviconUrl: result.url });
                                            }}
                                            onDelete={async () => {
                                                await uploadApi.deleteFavicon();
                                                handleSave({ faviconUrl: undefined });
                                            }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'seo' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>SEO Settings</CardTitle>
                                <CardDescription>Optimize your site for search engines</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="seoTitle">Page Title</Label>
                                    <Input
                                        id="seoTitle"
                                        defaultValue={settings.seoTitle}
                                        onBlur={(e) => handleSave({ seoTitle: e.target.value })}
                                        placeholder="Xcraper - Google Maps Contact Scraper"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="seoDescription">Meta Description</Label>
                                    <Input
                                        id="seoDescription"
                                        defaultValue={settings.seoDescription}
                                        onBlur={(e) => handleSave({ seoDescription: e.target.value })}
                                        placeholder="Extract business contacts from Google Maps..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="seoKeywords">Meta Keywords</Label>
                                    <Input
                                        id="seoKeywords"
                                        defaultValue={settings.seoKeywords}
                                        onBlur={(e) => handleSave({ seoKeywords: e.target.value })}
                                        placeholder="google maps scraper, lead generation, business contacts"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Open Graph Image</Label>
                                        <FileUpload
                                            currentUrl={settings.ogImageUrl}
                                            accept="image/png,image/jpeg,image/webp"
                                            maxSize={5 * 1024 * 1024}
                                            onUpload={async (file) => {
                                                const result = await uploadApi.uploadOgImage(file);
                                                handleSave({ ogImageUrl: result.url });
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="twitterHandle">Twitter Handle</Label>
                                        <Input
                                            id="twitterHandle"
                                            defaultValue={settings.twitterHandle || ''}
                                            onBlur={(e) => handleSave({ twitterHandle: optionalValue(e.target.value) })}
                                            placeholder="@xcraper"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'content' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Landing Page Content</CardTitle>
                                <CardDescription>Customize the landing page content</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="font-medium">Hero Section</h3>
                                    <div className="space-y-2">
                                        <Label htmlFor="heroTitle">Hero Title</Label>
                                        <Input
                                            id="heroTitle"
                                            defaultValue={settings.heroTitle}
                                            onBlur={(e) => handleSave({ heroTitle: e.target.value })}
                                            placeholder="Extract Business Leads from Google Maps"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                                        <Input
                                            id="heroSubtitle"
                                            defaultValue={settings.heroSubtitle}
                                            onBlur={(e) => handleSave({ heroSubtitle: e.target.value })}
                                            placeholder="Get phone numbers, emails, and addresses..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="heroCtaText">CTA Button Text</Label>
                                        <Input
                                            id="heroCtaText"
                                            defaultValue={settings.heroCtaText}
                                            onBlur={(e) => handleSave({ heroCtaText: e.target.value })}
                                            placeholder="Start Free Trial"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-medium">Features Section</h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="featuresTitle">Features Title</Label>
                                            <Input
                                                id="featuresTitle"
                                                defaultValue={settings.featuresTitle}
                                                onBlur={(e) => handleSave({ featuresTitle: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="featuresSubtitle">Features Subtitle</Label>
                                            <Input
                                                id="featuresSubtitle"
                                                defaultValue={settings.featuresSubtitle}
                                                onBlur={(e) => handleSave({ featuresSubtitle: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-medium">Pricing Section</h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="pricingTitle">Pricing Title</Label>
                                            <Input
                                                id="pricingTitle"
                                                defaultValue={settings.pricingTitle}
                                                onBlur={(e) => handleSave({ pricingTitle: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="pricingSubtitle">Pricing Subtitle</Label>
                                            <Input
                                                id="pricingSubtitle"
                                                defaultValue={settings.pricingSubtitle}
                                                onBlur={(e) => handleSave({ pricingSubtitle: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-medium">Credits & Access</h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="freeCreditsOnSignup">Free Credits on Signup</Label>
                                            <Input
                                                id="freeCreditsOnSignup"
                                                type="number"
                                                min={0}
                                                defaultValue={settings.freeCreditsOnSignup}
                                                onBlur={(e) => handleSave({ freeCreditsOnSignup: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="creditsPerStandardResult">Credits Per Standard Lead</Label>
                                            <Input
                                                id="creditsPerStandardResult"
                                                type="number"
                                                min={1}
                                                defaultValue={settings.creditsPerStandardResult ?? 1}
                                                onBlur={(e) => handleSave({ creditsPerStandardResult: parseInt(e.target.value) || 1 })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="creditsPerEnrichedResult">Credits Per Lead With Email</Label>
                                            <Input
                                                id="creditsPerEnrichedResult"
                                                type="number"
                                                min={1}
                                                defaultValue={settings.creditsPerEnrichedResult ?? 3}
                                                onBlur={(e) => handleSave({ creditsPerEnrichedResult: parseInt(e.target.value) || 3 })}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 pt-6">
                                            <input
                                                type="checkbox"
                                                id="registrationEnabled"
                                                defaultChecked={settings.registrationEnabled}
                                                onChange={(e) => handleSave({ registrationEnabled: e.target.checked })}
                                                className="h-4 w-4"
                                            />
                                            <Label htmlFor="registrationEnabled">Enable Registration</Label>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'pricing' && (
                        <div className="space-y-6">
                            {/* Subscription Plans */}
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

                            {/* Credit Packages */}
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
                    )}

                    {activeTab === 'advanced' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Advanced Settings</CardTitle>
                                <CardDescription>Integrations and contact information</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="font-medium">Google Tag Manager</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Connect Google Tag Manager to track analytics, conversions, and user behavior across your site.
                                    </p>
                                    <div className="space-y-2">
                                        <Label htmlFor="gtmContainerId">GTM Container ID</Label>
                                        <Input
                                            id="gtmContainerId"
                                            defaultValue={settings.gtmContainerId || ''}
                                            onBlur={(e) => handleSave({ gtmContainerId: optionalValue(e.target.value) })}
                                            placeholder="GTM-XXXXXXX"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Find your Container ID in Google Tag Manager under Admin → Container Settings
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t pt-4">
                                    <h3 className="font-medium">Contact Information</h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="contactEmail">Contact Email</Label>
                                            <Input
                                                id="contactEmail"
                                                type="email"
                                                defaultValue={settings.contactEmail || ''}
                                                onBlur={(e) => handleSave({ contactEmail: optionalValue(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="contactPhone">Contact Phone</Label>
                                            <Input
                                                id="contactPhone"
                                                defaultValue={settings.contactPhone || ''}
                                                onBlur={(e) => handleSave({ contactPhone: optionalValue(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contactAddress">Contact Address</Label>
                                        <Input
                                            id="contactAddress"
                                            defaultValue={settings.contactAddress || ''}
                                            onBlur={(e) => handleSave({ contactAddress: optionalValue(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
