import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminSettings } from './useAdminSettings';

export default function AdvancedPage() {
    const { settings, saveSetting, optionalValue, isSaving } = useAdminSettings();

    return (
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
                            onBlur={(e) => saveSetting({ gtmContainerId: optionalValue(e.target.value) })}
                            placeholder="GTM-XXXXXXX"
                            disabled={isSaving}
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
                                onBlur={(e) => saveSetting({ contactEmail: optionalValue(e.target.value) })}
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contactPhone">Contact Phone</Label>
                            <Input
                                id="contactPhone"
                                defaultValue={settings.contactPhone || ''}
                                onBlur={(e) => saveSetting({ contactPhone: optionalValue(e.target.value) })}
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="contactAddress">Contact Address</Label>
                        <Input
                            id="contactAddress"
                            defaultValue={settings.contactAddress || ''}
                            onBlur={(e) => saveSetting({ contactAddress: optionalValue(e.target.value) })}
                            disabled={isSaving}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
