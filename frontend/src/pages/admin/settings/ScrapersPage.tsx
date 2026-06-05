import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { settingsApi, type AdminScraperTemplate, type ScraperTemplateUpdate } from '@/lib/api';
import { Loader2, Save, Power } from 'lucide-react';

interface DraftState {
    actorId: string;
    actorName: string;
    creditsPerResult: string;
    costPerResultUsd: string;
    fixedStartCostUsd: string;
    memoryMb: string;
    minResults: string;
    maxResults: string;
    displayOrder: string;
    isActive: boolean;
}

function toDraft(s: AdminScraperTemplate): DraftState {
    return {
        actorId: s.actorId,
        actorName: s.actorName,
        creditsPerResult: String(s.creditsPerResult),
        costPerResultUsd: s.costPerResultUsd,
        fixedStartCostUsd: s.fixedStartCostUsd,
        memoryMb: String(s.memoryMb),
        minResults: String(s.minResults),
        maxResults: String(s.maxResults),
        displayOrder: String(s.displayOrder),
        isActive: s.isActive,
    };
}

function ScraperEditor({
    scraper,
    onSave,
    saving,
}: {
    scraper: AdminScraperTemplate;
    onSave: (key: string, update: ScraperTemplateUpdate) => void;
    saving: boolean;
}) {
    const [draft, setDraft] = useState<DraftState>(() => toDraft(scraper));

    useEffect(() => {
        setDraft(toDraft(scraper));
    }, [scraper]);

    const set = (key: keyof DraftState, value: string | boolean) =>
        setDraft((prev) => ({ ...prev, [key]: value }));

    const handleSave = () => {
        onSave(scraper.key, {
            actorId: draft.actorId.trim(),
            actorName: draft.actorName.trim(),
            creditsPerResult: Number(draft.creditsPerResult),
            costPerResultUsd: Number(draft.costPerResultUsd),
            fixedStartCostUsd: Number(draft.fixedStartCostUsd),
            memoryMb: Number(draft.memoryMb),
            minResults: Number(draft.minResults),
            maxResults: Number(draft.maxResults),
            displayOrder: Number(draft.displayOrder),
            isActive: draft.isActive,
        });
    };

    const field = (label: string, key: keyof DraftState, type: 'text' | 'number' = 'text') => (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            <Input
                type={type}
                value={draft[key] as string}
                onChange={(e) => set(key, e.target.value)}
            />
        </div>
    );

    return (
        <Card className="border-border">
            <CardContent className="space-y-5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground">{scraper.label}</h3>
                            <Badge variant="outline" className="text-[10px]">{scraper.source}</Badge>
                            <Badge variant="outline" className="text-[10px]">{scraper.billing}</Badge>
                            {scraper.extractsEmails && (
                                <Badge variant="outline" className="text-[10px]">emails</Badge>
                            )}
                            {!scraper.seeded && (
                                <Badge variant="outline" className="text-[10px] text-amber-600">code default</Badge>
                            )}
                        </div>
                        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{scraper.description}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">key: {scraper.key}</p>
                    </div>
                    <Button
                        type="button"
                        variant={draft.isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => set('isActive', !draft.isActive)}
                    >
                        <Power className="mr-1.5 h-3.5 w-3.5" />
                        {draft.isActive ? 'Active' : 'Disabled'}
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {field('Apify Actor ID', 'actorId')}
                    {field('Actor name', 'actorName')}
                    {field('Credits / result', 'creditsPerResult', 'number')}
                    {field('Apify cost / result (USD)', 'costPerResultUsd', 'number')}
                    {field('Fixed start cost (USD)', 'fixedStartCostUsd', 'number')}
                    {field('Memory (MB)', 'memoryMb', 'number')}
                    {field('Min results', 'minResults', 'number')}
                    {field('Max results', 'maxResults', 'number')}
                    {field('Display order', 'displayOrder', 'number')}
                </div>

                <div className="flex justify-end">
                    <Button type="button" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ScrapersPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['admin-scrapers'],
        queryFn: () => settingsApi.getScrapers(),
    });

    const mutation = useMutation({
        mutationFn: ({ key, update }: { key: string; update: ScraperTemplateUpdate }) =>
            settingsApi.updateScraper(key, update),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-scrapers'] });
            queryClient.invalidateQueries({ queryKey: ['scrapers'] });
            toast({ title: 'Scraper saved', description: 'Changes take effect within a minute (cache).' });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to save' });
        },
    });

    const scrapers = data?.scrapers ?? [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Scrapers</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Configure each data source. The scraper logic lives in code; here you control the Apify
                    actor, costs, credit price, limits, and whether it's available to users.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading scrapers...
                </div>
            ) : (
                <div className="space-y-4">
                    {scrapers.map((scraper) => (
                        <ScraperEditor
                            key={scraper.key}
                            scraper={scraper}
                            saving={mutation.isPending && mutation.variables?.key === scraper.key}
                            onSave={(key, update) => mutation.mutate({ key, update })}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
