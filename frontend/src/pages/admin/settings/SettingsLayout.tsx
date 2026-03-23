import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import {
    Activity,
    Contact,
    Cpu,
    DollarSign,
    Globe,
    LayoutDashboard,
    Palette,
    Receipt,
    Settings as SettingsIcon,
    TrendingUp,
    Users,
} from 'lucide-react';

type SettingsPage =
    | 'overview'
    | 'users'
    | 'logs'
    | 'contacts'
    | 'transactions'
    | 'branding'
    | 'seo'
    | 'content'
    | 'pricing'
    | 'advanced'
    | 'system'
    | 'pnl';

interface SettingsLayoutProps {
    children: React.ReactNode;
    currentPage: SettingsPage;
}

const tabs: { id: SettingsPage; label: string; icon: typeof Globe; path: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin' },
    { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
    { id: 'logs', label: 'Logs', icon: Activity, path: '/admin/searches' },
    { id: 'contacts', label: 'All Contacts', icon: Contact, path: '/admin/contacts' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, path: '/admin/transactions' },
    { id: 'pnl', label: 'P&L', icon: TrendingUp, path: '/admin/pnl' },
    { id: 'branding', label: 'Branding', icon: Palette, path: '/admin/settings/branding' },
    { id: 'seo', label: 'SEO', icon: Globe, path: '/admin/settings/seo' },
    { id: 'content', label: 'Content', icon: SettingsIcon, path: '/admin/settings/content' },
    { id: 'pricing', label: 'Pricing', icon: DollarSign, path: '/admin/settings/pricing' },
    { id: 'advanced', label: 'Advanced', icon: Cpu, path: '/admin/settings/advanced' },
    { id: 'system', label: 'System', icon: SettingsIcon, path: '/admin/settings/system' },
];

export function SettingsLayout({ children, currentPage }: SettingsLayoutProps) {
    return (
        <div className="w-full space-y-8">
            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="lg:w-56 lg:flex-shrink-0">
                    <Card className="border-border">
                        <CardContent className="p-2">
                            <nav className="space-y-1">
                                {tabs.map((tab) => (
                                    <Link
                                        key={tab.id}
                                        href={tab.path}
                                        className={`w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${currentPage === tab.id
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
