import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminSettings } from './useAdminSettings';

export default function BrandingPage() {
    const { settings, saveSetting, optionalValue, isSaving } = useAdminSettings();

    return (
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
                            onBlur={(e) => saveSetting({ brandName: e.target.value })}
                            placeholder="Xcraper"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="brandTagline">Tagline</Label>
                        <Input
                            id="brandTagline"
                            defaultValue={settings.brandTagline}
                            onBlur={(e) => saveSetting({ brandTagline: e.target.value })}
                            placeholder="Extract Business Contacts from Google Maps"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="brandDescription">Brand Description</Label>
                    <Input
                        id="brandDescription"
                        defaultValue={settings.brandDescription}
                        onBlur={(e) => saveSetting({ brandDescription: e.target.value })}
                        placeholder="The most powerful Google Maps scraping tool..."
                        disabled={isSaving}
                    />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="logoUrl">Logo URL</Label>
                        <Input
                            id="logoUrl"
                            type="url"
                            defaultValue={settings.logoUrl || ''}
                            onBlur={(e) => saveSetting({ logoUrl: optionalValue(e.target.value) })}
                            placeholder="https://example.com/logo.png"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="faviconUrl">Favicon URL</Label>
                        <Input
                            id="faviconUrl"
                            type="url"
                            defaultValue={settings.faviconUrl || ''}
                            onBlur={(e) => saveSetting({ faviconUrl: optionalValue(e.target.value) })}
                            placeholder="https://example.com/favicon.ico"
                            disabled={isSaving}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
