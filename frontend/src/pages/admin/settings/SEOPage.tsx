import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminSettings } from './useAdminSettings';

export default function SEOPage() {
    const { settings, saveSetting, optionalValue, isSaving } = useAdminSettings();

    return (
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
                        onBlur={(e) => saveSetting({ seoTitle: e.target.value })}
                        placeholder="Xcraper - Google Maps Contact Scraper"
                        disabled={isSaving}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="seoDescription">Meta Description</Label>
                    <Input
                        id="seoDescription"
                        defaultValue={settings.seoDescription}
                        onBlur={(e) => saveSetting({ seoDescription: e.target.value })}
                        placeholder="Extract business contacts from Google Maps..."
                        disabled={isSaving}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="seoKeywords">Meta Keywords</Label>
                    <Input
                        id="seoKeywords"
                        defaultValue={settings.seoKeywords}
                        onBlur={(e) => saveSetting({ seoKeywords: e.target.value })}
                        placeholder="google maps scraper, lead generation, business contacts"
                        disabled={isSaving}
                    />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="ogImageUrl">Open Graph Image URL</Label>
                        <Input
                            id="ogImageUrl"
                            type="url"
                            defaultValue={settings.ogImageUrl || ''}
                            onBlur={(e) => saveSetting({ ogImageUrl: optionalValue(e.target.value) })}
                            placeholder="https://example.com/og-image.png"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="twitterHandle">Twitter Handle</Label>
                        <Input
                            id="twitterHandle"
                            defaultValue={settings.twitterHandle || ''}
                            onBlur={(e) => saveSetting({ twitterHandle: optionalValue(e.target.value) })}
                            placeholder="@xcraper"
                            disabled={isSaving}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
