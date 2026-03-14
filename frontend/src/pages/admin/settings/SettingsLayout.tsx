import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Globe, Palette, DollarSign, Cpu, Settings as SettingsIcon } from 'lucide-react';
import { useAdminSettings } from './useAdminSettings';

type SettingsPage = 'branding' | 'seo' | 'content' | 'pricing' | 'advanced';

interface SettingsLayoutProps {
    children: React.ReactNode;
    currentPage: SettingsPage;
}

const tabs: { id: SettingsPage; label: string; icon: typeof Globe; path: string }[] = [
    { id: 'branding', label: 'Branding', icon: Palette, path: '/admin/settings/branding' },
    { id: 'seo', label: 'SEO', icon: Globe, path: '/admin/settings/seo' },
    { id: 'content', label: 'Content', icon: SettingsIcon, path: '/admin/settings/content' },
    { id: 'pricing', label: 'Pricing', icon: DollarSign, path: '/admin/settings/pricing' },
    { id: 'advanced', label: 'Advanced', icon: Cpu, path: '/admin/settings/advanced' },
];

export function SettingsLayout({ children, currentPage }: SettingsLayoutProps) {
    const { isLoading } = useAdminSettings();

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
                                    <Link
                                        key={tab.id}
                                        href={tab.path}
                                        className={`w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                            currentPage === tab.id
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-slate-700 dark:text-white hover:bg-muted hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <tab.icon className="h-4 w-4" />
                                        {tab.label}
                                    </Link>
                                ))}
                            </nav>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex-1">
                    {children}
                </div>
            </div>
        </div>
    );
}
