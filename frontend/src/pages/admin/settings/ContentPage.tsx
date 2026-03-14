import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminSettings } from './useAdminSettings';

export default function ContentPage() {
    const { settings, saveSetting, isSaving } = useAdminSettings();

    return (
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
                            onBlur={(e) => saveSetting({ heroTitle: e.target.value })}
                            placeholder="Extract Business Leads from Google Maps"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                        <Input
                            id="heroSubtitle"
                            defaultValue={settings.heroSubtitle}
                            onBlur={(e) => saveSetting({ heroSubtitle: e.target.value })}
                            placeholder="Get phone numbers, emails, and addresses..."
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="heroCtaText">CTA Button Text</Label>
                        <Input
                            id="heroCtaText"
                            defaultValue={settings.heroCtaText}
                            onBlur={(e) => saveSetting({ heroCtaText: e.target.value })}
                            placeholder="Start Free Trial"
                            disabled={isSaving}
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
                                onBlur={(e) => saveSetting({ featuresTitle: e.target.value })}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="featuresSubtitle">Features Subtitle</Label>
                            <Input
                                id="featuresSubtitle"
                                defaultValue={settings.featuresSubtitle}
                                onBlur={(e) => saveSetting({ featuresSubtitle: e.target.value })}
                                disabled={isSaving}
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
                                onBlur={(e) => saveSetting({ pricingTitle: e.target.value })}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pricingSubtitle">Pricing Subtitle</Label>
                            <Input
                                id="pricingSubtitle"
                                defaultValue={settings.pricingSubtitle}
                                onBlur={(e) => saveSetting({ pricingSubtitle: e.target.value })}
                                disabled={isSaving}
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
                                onBlur={(e) => saveSetting({ freeCreditsOnSignup: parseInt(e.target.value) || 0 })}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="creditsPerStandardResult">Credits Per Standard Lead</Label>
                            <Input
                                id="creditsPerStandardResult"
                                type="number"
                                min={1}
                                defaultValue={settings.creditsPerStandardResult ?? 1}
                                onBlur={(e) => saveSetting({ creditsPerStandardResult: parseInt(e.target.value) || 1 })}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="creditsPerEnrichedResult">Credits Per Lead With Email</Label>
                            <Input
                                id="creditsPerEnrichedResult"
                                type="number"
                                min={1}
                                defaultValue={settings.creditsPerEnrichedResult ?? 3}
                                onBlur={(e) => saveSetting({ creditsPerEnrichedResult: parseInt(e.target.value) || 3 })}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                            <input
                                type="checkbox"
                                id="registrationEnabled"
                                defaultChecked={settings.registrationEnabled}
                                onChange={(e) => saveSetting({ registrationEnabled: e.target.checked })}
                                className="h-4 w-4"
                                disabled={isSaving}
                            />
                            <Label htmlFor="registrationEnabled">Enable Registration</Label>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
