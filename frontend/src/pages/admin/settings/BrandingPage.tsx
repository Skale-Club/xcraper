import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { useAdminSettings } from './useAdminSettings';
import { uploadApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function BrandingPage() {
    const { settings, saveSetting, isSaving } = useAdminSettings();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const handleLogoUpload = async (file: File) => {
        try {
            const result = await uploadApi.uploadLogo(file);
            saveSetting({ logoUrl: result.url });
            queryClient.invalidateQueries({ queryKey: ['public-settings'] });
            toast({ title: 'Logo uploaded successfully!' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload logo' });
        }
    };

    const handleLogoDelete = async () => {
        try {
            await uploadApi.deleteLogo();
            saveSetting({ logoUrl: undefined });
            queryClient.invalidateQueries({ queryKey: ['public-settings'] });
            toast({ title: 'Logo removed successfully!' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove logo' });
        }
    };

    const handleFaviconUpload = async (file: File) => {
        try {
            const result = await uploadApi.uploadFavicon(file);
            saveSetting({ faviconUrl: result.url });
            queryClient.invalidateQueries({ queryKey: ['public-settings'] });
            toast({ title: 'Favicon uploaded successfully!' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload favicon' });
        }
    };

    const handleFaviconDelete = async () => {
        try {
            await uploadApi.deleteFavicon();
            saveSetting({ faviconUrl: undefined });
            queryClient.invalidateQueries({ queryKey: ['public-settings'] });
            toast({ title: 'Favicon removed successfully!' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove favicon' });
        }
    };

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
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Logo</Label>
                        <FileUpload
                            currentUrl={settings.logoUrl}
                            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
                            maxSize={5 * 1024 * 1024}
                            onUpload={handleLogoUpload}
                            onDelete={handleLogoDelete}
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Favicon</Label>
                        <FileUpload
                            currentUrl={settings.faviconUrl}
                            accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                            maxSize={1 * 1024 * 1024}
                            onUpload={handleFaviconUpload}
                            onDelete={handleFaviconDelete}
                            disabled={isSaving}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
