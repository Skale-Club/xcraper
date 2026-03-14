import { Link, useLocation } from 'wouter';
import {
    ChevronsLeft,
    ChevronsRight,
    Coins,
    LayoutDashboard,
    LogOut,
    Settings,
    Users,
    Contact,
    Receipt,
    Shield,
    History,
    CreditCard,
    Moon,
    Sun,
    Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';

type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
};

const baseNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/searches', label: 'Searches', icon: History },
    { href: '/billing', label: 'Billing', icon: CreditCard },
];

const adminNavItems: NavItem[] = [
    { href: '/admin', label: 'Admin Dashboard', icon: Shield },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/searches', label: 'Search Logs', icon: Activity },
    { href: '/admin/contacts', label: 'All Contacts', icon: Contact },
    { href: '/admin/transactions', label: 'Transactions', icon: Receipt },
    { href: '/admin/settings/branding', label: 'Settings', icon: Settings },
];

interface AppSidebarProps {
    user: AppUser | null;
    collapsed?: boolean;
    showCollapseToggle?: boolean;
    onLogout: () => Promise<void>;
    onToggleCollapse?: () => void;
    onNavigate?: () => void;
}

export default function AppSidebar({
    user,
    collapsed = false,
    showCollapseToggle = false,
    onLogout,
    onToggleCollapse,
    onNavigate,
}: AppSidebarProps) {
    const [location] = useLocation();
    const { theme, setTheme } = useTheme();
    const isAdmin = user?.role === 'admin';
    const displayedCredits = user?.totalCredits ?? user?.credits ?? 0;
    // Filter out Billing menu item for admins (they don't need credits/billing)
    const navItems = isAdmin
        ? baseNavItems.filter((item) => item.href !== '/billing')
        : baseNavItems;

    return (
        <div className="flex h-full flex-col bg-background dark:bg-[#0B1120] text-foreground dark:text-slate-200 border-r border-border dark:border-slate-800 shadow-xl">
            {/* Header / Logo */}
            <div className={cn('relative flex-shrink-0', collapsed ? 'px-3 py-6' : 'px-6 py-6')}>
                <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between gap-4')}>
                    <Link
                        href="/dashboard"
                        onClick={onNavigate}
                        className={cn('flex items-center transition-opacity hover:opacity-90', collapsed ? 'justify-center' : 'gap-3')}
                    >
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg overflow-hidden">
                            <img src="/favicon.png" alt="Xcraper" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20"></div>
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col">
                                <span className="text-xl font-bold tracking-tight text-foreground dark:text-white leading-tight">Xcraper</span>
                                <span className="text-xs font-medium text-muted-foreground dark:text-slate-400">Lead generation</span>
                            </div>
                        )}
                    </Link>
                </div>
            </div>

            {/* User Profile Area - Simplified */}
            <div className={cn('px-4 py-4', collapsed && 'px-2')}>
                <Link
                    href="/profile"
                    onClick={onNavigate}
                    title={collapsed ? 'Profile settings' : undefined}
                    className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border border-transparent px-2 py-2 text-left transition-colors hover:border-border hover:bg-muted/40',
                        collapsed && 'flex-col'
                    )}
                >
                    <div className="h-10 w-10 rounded-full bg-muted dark:bg-gradient-to-br dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-border dark:border-slate-600/50 shadow-inner overflow-hidden">
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name || 'User'} className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-sm font-semibold text-foreground dark:text-slate-300">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        )}
                    </div>
                    {!collapsed && (
                        <div className="overflow-hidden">
                            <p className="truncate text-sm font-semibold text-foreground dark:text-white">
                                {user?.name || 'Workspace User'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground dark:text-slate-400">{user?.email}</p>
                        </div>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-muted dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <nav className="space-y-1">
                    {!collapsed && (
                        <div className="px-3 pb-2 pt-2">
                            <p className="text-xs font-semibold tracking-wider text-muted-foreground dark:text-slate-500 uppercase">Menu</p>
                        </div>
                    )}
                    
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onNavigate}
                                title={collapsed ? item.label : undefined}
                                className={cn(
                                    'group flex items-center rounded-xl text-sm font-medium transition-all duration-200',
                                    collapsed ? 'justify-center p-3 my-1' : 'gap-3 px-3 py-2.5',
                                    isActive
                                        ? 'bg-blue-100 dark:bg-blue-600/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
                                        : 'text-muted-foreground dark:text-slate-400 hover:bg-muted dark:hover:bg-slate-800/50 hover:text-foreground dark:hover:text-slate-100 border border-transparent'
                                )}
                            >
                                <Icon className={cn("shrink-0 transition-colors", collapsed ? "h-5 w-5" : "h-4 w-4", isActive ? "text-blue-700 dark:text-blue-400" : "text-muted-foreground dark:text-slate-500 group-hover:text-foreground dark:group-hover:text-slate-300")} />
                                {!collapsed && <span>{item.label}</span>}
                                {isActive && !collapsed && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>
                                )}
                            </Link>
                        );
                    })}

                    {/* Admin Section */}
                    {isAdmin && (
                        <div className="mt-6">
                            {!collapsed && (
                                <div className="px-3 pb-2 pt-4">
                                    <p className="text-xs font-semibold tracking-wider text-muted-foreground dark:text-slate-500 uppercase flex items-center gap-1.5">
                                        <Shield className="h-3 w-3" />
                                        Administration
                                    </p>
                                </div>
                            )}
                            {collapsed && (
                                <div className="mx-auto my-4 h-px w-8 bg-border dark:bg-slate-800" />
                            )}
                            
                            <div className="space-y-1">
                                {adminNavItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location === item.href;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onNavigate}
                                            title={collapsed ? item.label : undefined}
                                            className={cn(
                                                'group flex items-center rounded-xl text-sm font-medium transition-all duration-200',
                                                collapsed ? 'justify-center p-3 my-1' : 'gap-3 px-3 py-2.5',
                                                isActive
                                                    ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20'
                                                    : 'text-muted-foreground dark:text-slate-400 hover:bg-muted dark:hover:bg-slate-800/50 hover:text-foreground dark:hover:text-slate-100 border border-transparent'
                                            )}
                                        >
                                            <Icon className={cn("shrink-0 transition-colors", collapsed ? "h-5 w-5" : "h-4 w-4", isActive ? "text-purple-700 dark:text-purple-400" : "text-muted-foreground dark:text-slate-500 group-hover:text-foreground dark:group-hover:text-slate-300")} />
                                            {!collapsed && <span>{item.label}</span>}
                                            {isActive && !collapsed && (
                                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]"></div>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </nav>
            </div>

            {/* Footer / Logout */}
            <div className={cn('mt-auto border-t border-border dark:border-slate-800/80 bg-muted/20 dark:bg-slate-900/50 p-3 flex flex-col gap-2', collapsed ? 'px-2' : 'px-4')}>
                {/* Credits Display for non-admin users */}
                {!isAdmin && (
                    <div className={cn(
                        'rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/50 p-3',
                        collapsed && 'p-2'
                    )}>
                        {!collapsed ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                                        <Coins className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground dark:text-slate-400">Credits</p>
                                        <p className="text-lg font-bold text-foreground dark:text-white">{displayedCredits}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1">
                                <div className="h-7 w-7 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                                    <Coins className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="text-xs font-bold text-foreground dark:text-white">{displayedCredits}</span>
                            </div>
                        )}
                    </div>
                )}

                {showCollapseToggle && onToggleCollapse && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className={cn(
                            'hidden lg:flex w-full items-center rounded-xl text-muted-foreground dark:text-slate-400 transition-all hover:bg-muted dark:hover:bg-slate-800 hover:text-foreground dark:hover:text-white',
                            collapsed ? 'justify-center p-3' : 'justify-start px-3 py-3'
                        )}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? (
                            <ChevronsRight className="h-5 w-5" />
                        ) : (
                            <>
                                <ChevronsLeft className="mr-3 h-4 w-4" />
                                <span className="font-medium text-sm">Collapse</span>
                            </>
                        )}
                    </button>
                )}
                
                <Button
                    variant="ghost"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    title={collapsed ? 'Toggle theme' : undefined}
                    className={cn(
                        'group w-full rounded-xl text-muted-foreground dark:text-slate-400 transition-all hover:bg-muted dark:hover:bg-slate-800 hover:text-foreground dark:hover:text-white',
                        collapsed ? 'h-12 justify-center px-0' : 'justify-start px-3 py-5'
                    )}
                >
                    {theme === 'dark' ? (
                        <Sun className={cn('transition-transform group-hover:rotate-45', collapsed ? 'h-5 w-5' : 'mr-3 h-4 w-4')} />
                    ) : (
                        <Moon className={cn('transition-transform group-hover:-rotate-12', collapsed ? 'h-5 w-5' : 'mr-3 h-4 w-4')} />
                    )}
                    {!collapsed && <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
                </Button>
                
                <Button
                    variant="ghost"
                    onClick={onLogout}
                    title={collapsed ? 'Logout' : undefined}
                    className={cn(
                        'group w-full rounded-xl text-muted-foreground dark:text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400',
                        collapsed ? 'h-12 justify-center px-0' : 'justify-start px-3 py-5'
                    )}
                >
                    <LogOut className={cn('transition-transform group-hover:-translate-x-1', collapsed ? 'h-5 w-5' : 'mr-3 h-4 w-4')} />
                    {!collapsed && <span className="font-medium">Sign Out</span>}
                </Button>
            </div>
        </div>
    );
}
