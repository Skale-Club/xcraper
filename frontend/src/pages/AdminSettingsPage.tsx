import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageIntro from '@/components/app/PageIntro';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { settingsApi, ApiError, AdminSettings, AdminCreditPackage } from '@/lib/api';
import {
    Loader2,
    Plus,
    Trash2,
    Globe,
    Palette,
    DollarSign,
    Code,
    Settings as SettingsIcon,
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

    const handleSave = (data: Partial<AdminSettings>) => {
        updateMutation.mutate(data);
    };

    const optionalValue = (value: string) => value || undefined;

    const tabs: { id: SettingsTab; label: string; icon: typeof Globe }[] = [
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'seo', label: 'SEO', icon: Globe },
        { id: 'content', label: 'Content', icon: SettingsIcon },
        { id: 'pricing', label: 'Pricing', icon: DollarSign },
        { id: 'advanced', label: 'Advanced', icon: Code },
    ];

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-8">
            <PageIntro
                eyebrow="Administration"
                title="Admin Settings"
                description="Configure the brand, landing page, pricing packages, and advanced platform settings."
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="lg:w-64 lg:flex-shrink-0">
                    <Card>
                        <CardContent className="p-2">
                            <nav className="space-y-1">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-gray-600 hover:bg-gray-100'
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
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="logoUrl">Logo URL</Label>
                                        <Input
                                            id="logoUrl"
                                            type="url"
                                            defaultValue={settings.logoUrl || ''}
                                            onBlur={(e) => handleSave({ logoUrl: optionalValue(e.target.value) })}
                                            placeholder="https://example.com/logo.png"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="faviconUrl">Favicon URL</Label>
                                        <Input
                                            id="faviconUrl"
                                            type="url"
                                            defaultValue={settings.faviconUrl || ''}
                                            onBlur={(e) => handleSave({ faviconUrl: optionalValue(e.target.value) })}
                                            placeholder="https://example.com/favicon.ico"
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
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="ogImageUrl">Open Graph Image URL</Label>
                                        <Input
                                            id="ogImageUrl"
                                            type="url"
                                            defaultValue={settings.ogImageUrl || ''}
                                            onBlur={(e) => handleSave({ ogImageUrl: optionalValue(e.target.value) })}
                                            placeholder="https://example.com/og-image.png"
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
                        <Card>
                            <CardHeader>
                                <CardTitle>Credit Packages</CardTitle>
                                <CardDescription>Manage pricing packages</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {packages.map((pkg) => (
                                        <div
                                            key={pkg.id}
                                            className="flex items-center justify-between rounded-lg bg-gray-50 p-4"
                                        >
                                            <div>
                                                <p className="font-medium">{pkg.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {pkg.credits} credits - ${pkg.price}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {pkg.isPopular && (
                                                    <span className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                                                        Popular
                                                    </span>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deletePackageMutation.mutate(pkg.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => {
                                            createPackageMutation.mutate({
                                                name: 'New Package',
                                                credits: 100,
                                                price: '19.99',
                                            });
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Package
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'advanced' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Advanced Settings</CardTitle>
                                <CardDescription>Custom code and integrations</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="googleAnalyticsId">Google Analytics ID</Label>
                                    <Input
                                        id="googleAnalyticsId"
                                        defaultValue={settings.googleAnalyticsId || ''}
                                        onBlur={(e) => handleSave({ googleAnalyticsId: optionalValue(e.target.value) })}
                                        placeholder="G-XXXXXXXXXX"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customHeadCode">Custom Head Code</Label>
                                    <textarea
                                        id="customHeadCode"
                                        className="min-h-[100px] w-full rounded-lg border p-3 font-mono text-sm"
                                        defaultValue={settings.customHeadCode || ''}
                                        onBlur={(e) => handleSave({ customHeadCode: optionalValue(e.target.value) })}
                                        placeholder="<!-- Custom code to inject in <head> -->"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customBodyCode">Custom Body Code</Label>
                                    <textarea
                                        id="customBodyCode"
                                        className="min-h-[100px] w-full rounded-lg border p-3 font-mono text-sm"
                                        defaultValue={settings.customBodyCode || ''}
                                        onBlur={(e) => handleSave({ customBodyCode: optionalValue(e.target.value) })}
                                        placeholder="<!-- Custom code to inject before </body> -->"
                                    />
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
