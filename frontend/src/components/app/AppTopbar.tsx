import { Menu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const pageMetadata: Record<string, { title: string; description: string }> = {
    '/dashboard': {
        title: 'Dashboard',
        description: 'Search Google Maps, track activity, and keep credits under control.',
    },
    '/contacts': {
        title: 'Contacts',
        description: 'Review, organize, and export the leads you have saved.',
    },
    '/credits': {
        title: 'Credits',
        description: 'Monitor your balance, package options, and transaction history.',
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

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
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
                
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
