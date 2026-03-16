import { Menu, Plus } from 'lucide-react';
import { useSearchSurvey } from '@/hooks/useSearchSurvey';

const pageMetadata: Record<string, { title: string; description: string }> = {
    '/dashboard': {
        title: 'Dashboard',
        description: 'Search Google Maps, track activity, and keep credits under control.',
    },
    '/searches': {
        title: 'Searches',
        description: 'Review, organize, and export the leads you have saved from your searches.',
    },
    '/billing': {
        title: 'Billing',
        description: 'Manage your subscription, credit packages, and view transaction history.',
    },
    '/profile': {
        title: 'Profile',
        description: 'Update your account information and password.',
    },
    '/admin/settings': {
        title: 'Admin Settings',
        description: 'Control branding, pricing, and global product configuration.',
    },
};

interface AppTopbarProps {
    location: string;
    onOpenSidebar: () => void;
}

export default function AppTopbar({ location, onOpenSidebar }: AppTopbarProps) {
    const currentPage = pageMetadata[location] ?? pageMetadata['/dashboard'];
    const { openSearchSurvey } = useSearchSurvey();
    const showNewSearchButton = !location.startsWith('/admin');

    const handleNewSearch = () => {
        openSearchSurvey();
    };

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
                <div className="flex min-w-0 items-center gap-4">
                    <button
                        type="button"
                        onClick={onOpenSidebar}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-foreground shadow-sm lg:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            Workspace
                        </p>
                        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                            {currentPage.title}
                        </h1>
                        <p className="hidden text-sm text-muted-foreground md:block">
                            {currentPage.description}
                        </p>
                    </div>
                </div>

                {showNewSearchButton && (
                    <button
                        type="button"
                        onClick={handleNewSearch}
                        className="group flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-3 text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
                    >
                        <Plus className="h-5 w-5 text-blue-400 transition-transform duration-200 group-hover:rotate-90" />
                        <span className="text-sm font-semibold tracking-tight">New Search</span>
                    </button>
                )}
            </div>
        </header>
    );
}
