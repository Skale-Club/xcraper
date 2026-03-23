import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminSettings } from './useAdminSettings';

export default function SystemPage() {
    const {
        systemSettings,
        saveSystemSetting,
        optionalValue,
        isSavingSystem,
    } = useAdminSettings();

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Scraper Runtime</CardTitle>
                    <CardDescription>Configure Apify actors, estimated run costs, and search defaults.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="defaultSearchLanguage">Default Search Language</Label>
                            <Input
                                id="defaultSearchLanguage"
                                defaultValue={systemSettings.defaultSearchLanguage || 'en'}
                                onBlur={(e) => saveSystemSetting({ defaultSearchLanguage: e.target.value || 'en' })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="defaultSearchCountryCode">Default Country Code</Label>
                            <Input
                                id="defaultSearchCountryCode"
                                defaultValue={systemSettings.defaultSearchCountryCode || 'us'}
                                onBlur={(e) => saveSystemSetting({ defaultSearchCountryCode: e.target.value || 'us' })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="apifyBaseRunCostUsd">Apify Base Run Cost (USD)</Label>
                            <Input
                                id="apifyBaseRunCostUsd"
                                defaultValue={systemSettings.apifyBaseRunCostUsd || '0.0200'}
                                onBlur={(e) => saveSystemSetting({ apifyBaseRunCostUsd: e.target.value || '0.0200' })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="apifyMinRunChargeUsd">Apify Minimum Run Charge (USD)</Label>
                            <Input
                                id="apifyMinRunChargeUsd"
                                defaultValue={systemSettings.apifyMinRunChargeUsd || '0.5000'}
                                onBlur={(e) => saveSystemSetting({ apifyMinRunChargeUsd: e.target.value || '0.5000' })}
                                disabled={isSavingSystem}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="space-y-4 rounded-xl border p-4">
                            <h3 className="font-medium">Standard Actor</h3>
                            <div className="space-y-2">
                                <Label htmlFor="apifyStandardActorId">Actor ID</Label>
                                <Input
                                    id="apifyStandardActorId"
                                    defaultValue={systemSettings.apifyStandardActorId || ''}
                                    onBlur={(e) => saveSystemSetting({ apifyStandardActorId: e.target.value })}
                                    disabled={isSavingSystem}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apifyStandardActorName">Actor Name</Label>
                                <Input
                                    id="apifyStandardActorName"
                                    defaultValue={systemSettings.apifyStandardActorName || ''}
                                    onBlur={(e) => saveSystemSetting({ apifyStandardActorName: e.target.value })}
                                    disabled={isSavingSystem}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="apifyStandardCostPerResultUsd">Cost / Result</Label>
                                    <Input
                                        id="apifyStandardCostPerResultUsd"
                                        defaultValue={systemSettings.apifyStandardCostPerResultUsd || '0.0040'}
                                        onBlur={(e) => saveSystemSetting({ apifyStandardCostPerResultUsd: e.target.value || '0.0040' })}
                                        disabled={isSavingSystem}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="apifyStandardFixedStartCostUsd">Fixed Start Cost</Label>
                                    <Input
                                        id="apifyStandardFixedStartCostUsd"
                                        defaultValue={systemSettings.apifyStandardFixedStartCostUsd || '0.0070'}
                                        onBlur={(e) => saveSystemSetting({ apifyStandardFixedStartCostUsd: e.target.value || '0.0070' })}
                                        disabled={isSavingSystem}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="apifyStandardMemoryMb">Memory (MB)</Label>
                                    <Input
                                        id="apifyStandardMemoryMb"
                                        type="number"
                                        min={128}
                                        defaultValue={systemSettings.apifyStandardMemoryMb ?? 2048}
                                        onBlur={(e) => saveSystemSetting({ apifyStandardMemoryMb: parseInt(e.target.value, 10) || 2048 })}
                                        disabled={isSavingSystem}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 rounded-xl border p-4">
                            <h3 className="font-medium">Enriched Actor</h3>
                            <div className="space-y-2">
                                <Label htmlFor="apifyEnrichedActorId">Actor ID</Label>
                                <Input
                                    id="apifyEnrichedActorId"
                                    defaultValue={systemSettings.apifyEnrichedActorId || ''}
                                    onBlur={(e) => saveSystemSetting({ apifyEnrichedActorId: e.target.value })}
                                    disabled={isSavingSystem}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apifyEnrichedActorName">Actor Name</Label>
                                <Input
                                    id="apifyEnrichedActorName"
                                    defaultValue={systemSettings.apifyEnrichedActorName || ''}
                                    onBlur={(e) => saveSystemSetting({ apifyEnrichedActorName: e.target.value })}
                                    disabled={isSavingSystem}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="apifyEnrichedCostPerResultUsd">Cost / Result</Label>
                                    <Input
                                        id="apifyEnrichedCostPerResultUsd"
                                        defaultValue={systemSettings.apifyEnrichedCostPerResultUsd || '0.0090'}
                                        onBlur={(e) => saveSystemSetting({ apifyEnrichedCostPerResultUsd: e.target.value || '0.0090' })}
                                        disabled={isSavingSystem}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="apifyEnrichedFixedStartCostUsd">Fixed Start Cost</Label>
                                    <Input
                                        id="apifyEnrichedFixedStartCostUsd"
                                        defaultValue={systemSettings.apifyEnrichedFixedStartCostUsd || '0.0000'}
                                        onBlur={(e) => saveSystemSetting({ apifyEnrichedFixedStartCostUsd: e.target.value || '0.0000' })}
                                        disabled={isSavingSystem}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="apifyEnrichedMemoryMb">Memory (MB)</Label>
                                    <Input
                                        id="apifyEnrichedMemoryMb"
                                        type="number"
                                        min={128}
                                        defaultValue={systemSettings.apifyEnrichedMemoryMb ?? 2048}
                                        onBlur={(e) => saveSystemSetting({ apifyEnrichedMemoryMb: parseInt(e.target.value, 10) || 2048 })}
                                        disabled={isSavingSystem}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Public Runtime Config</CardTitle>
                    <CardDescription>Values exposed to the browser and safe to manage from the admin panel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="publicGoogleMapsApiKey">Google Maps Browser API Key</Label>
                            <Input
                                id="publicGoogleMapsApiKey"
                                defaultValue={systemSettings.publicGoogleMapsApiKey || ''}
                                onBlur={(e) => saveSystemSetting({ publicGoogleMapsApiKey: optionalValue(e.target.value) })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="publicSentryDsn">Public Sentry DSN</Label>
                            <Input
                                id="publicSentryDsn"
                                defaultValue={systemSettings.publicSentryDsn || ''}
                                onBlur={(e) => saveSystemSetting({ publicSentryDsn: optionalValue(e.target.value) })}
                                disabled={isSavingSystem}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>PWA Settings</CardTitle>
                    <CardDescription>Controls the installable app metadata served to browsers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="pwaName">App Name</Label>
                            <Input
                                id="pwaName"
                                defaultValue={systemSettings.pwaName || 'Xcraper'}
                                onBlur={(e) => saveSystemSetting({ pwaName: e.target.value || 'Xcraper' })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pwaShortName">Short Name</Label>
                            <Input
                                id="pwaShortName"
                                defaultValue={systemSettings.pwaShortName || 'Xcraper'}
                                onBlur={(e) => saveSystemSetting({ pwaShortName: e.target.value || 'Xcraper' })}
                                disabled={isSavingSystem}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pwaDescription">Description</Label>
                        <Input
                            id="pwaDescription"
                            defaultValue={systemSettings.pwaDescription || 'Google Maps lead generation and contact scraping platform.'}
                            onBlur={(e) => saveSystemSetting({ pwaDescription: e.target.value || 'Google Maps lead generation and contact scraping platform.' })}
                            disabled={isSavingSystem}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="pwaThemeColor">Theme Color</Label>
                            <Input
                                id="pwaThemeColor"
                                defaultValue={systemSettings.pwaThemeColor || '#0f172a'}
                                onBlur={(e) => saveSystemSetting({ pwaThemeColor: e.target.value || '#0f172a' })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pwaBackgroundColor">Background Color</Label>
                            <Input
                                id="pwaBackgroundColor"
                                defaultValue={systemSettings.pwaBackgroundColor || '#0f172a'}
                                onBlur={(e) => saveSystemSetting({ pwaBackgroundColor: e.target.value || '#0f172a' })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pwaIcon192Url">Icon 192 URL</Label>
                            <Input
                                id="pwaIcon192Url"
                                defaultValue={systemSettings.pwaIcon192Url || ''}
                                onBlur={(e) => saveSystemSetting({ pwaIcon192Url: optionalValue(e.target.value) })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pwaAppleTouchIconUrl">Apple Touch Icon URL</Label>
                            <Input
                                id="pwaAppleTouchIconUrl"
                                defaultValue={systemSettings.pwaAppleTouchIconUrl || ''}
                                onBlur={(e) => saveSystemSetting({ pwaAppleTouchIconUrl: optionalValue(e.target.value) })}
                                disabled={isSavingSystem}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="pwaIcon512Url">Icon 512 URL</Label>
                            <Input
                                id="pwaIcon512Url"
                                defaultValue={systemSettings.pwaIcon512Url || ''}
                                onBlur={(e) => saveSystemSetting({ pwaIcon512Url: optionalValue(e.target.value) })}
                                disabled={isSavingSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pwaMaskableIcon512Url">Maskable 512 URL</Label>
                            <Input
                                id="pwaMaskableIcon512Url"
                                defaultValue={systemSettings.pwaMaskableIcon512Url || ''}
                                onBlur={(e) => saveSystemSetting({ pwaMaskableIcon512Url: optionalValue(e.target.value) })}
                                disabled={isSavingSystem}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
