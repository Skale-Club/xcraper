import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { useAdminSettings } from './useAdminSettings';
import { uploadApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function SEOPage() {
    const { settings, saveSetting, optionalValue, isSaving } = useAdminSettings();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const handleOgImageUpload = async (file: File) => {
        try {
            const result = await uploadApi.uploadOgImage(file);
            saveSetting({ ogImageUrl: result.url });
            queryClient.invalidateQueries({ queryKey: ['public-settings'] });
            toast({ title: 'OG Image uploaded successfully!' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload OG image' });
        }
    };

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
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Open Graph Image</Label>
                        <FileUpload
                            currentUrl={settings.ogImageUrl}
                            accept="image/png,image/jpeg,image/webp"
                            maxSize={5 * 1024 * 1024}
                            onUpload={handleOgImageUpload}
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
