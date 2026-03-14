import { Link, useLocation } from 'wouter';
import {
    ChevronsLeft,
    ChevronsRight,
    Coins,
    Database,
    LayoutDashboard,
    LogOut,
    Settings,
    Users,
    Contact,
    Receipt,
    Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/hooks/useAuth';

type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
};

const baseNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/contacts', label: 'Contacts', icon: Database },
    { href: '/credits', label: 'Credits', icon: Coins },
];

const adminNavItems: NavItem[] = [
    { href: '/admin', label: 'Admin Dashboard', icon: Shield },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/contacts', label: 'All Contacts', icon: Contact },
    { href: '/admin/transactions', label: 'Transactions', icon: Receipt },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
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
    const navItems = baseNavItems;
    const isAdmin = user?.role === 'admin';

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
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
                            XC
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

            {/* User Profile Area */}
            <div className={cn('px-4 py-4', collapsed && 'px-2')}>
                <div
                    className={cn(
                        'group relative overflow-hidden rounded-2xl border border-border dark:border-slate-800 bg-muted/30 dark:bg-slate-800/30 transition-all hover:bg-muted/50 dark:hover:bg-slate-800/50',
                        collapsed ? 'p-2 flex flex-col items-center gap-3' : 'p-4'
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100"></div>
                    
                    {!collapsed ? (
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-10 w-10 rounded-full bg-muted dark:bg-gradient-to-br dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-border dark:border-slate-600/50 shadow-inner">
                                    <span className="text-sm font-semibold text-foreground dark:text-slate-300">
                                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                                    </span>
                                </div>
                                <div className="overflow-hidden">
                                    <p className="truncate text-sm font-semibold text-foreground dark:text-white">
                                        {user?.name || 'Workspace User'}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground dark:text-slate-400">{user?.email}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between rounded-xl bg-background dark:bg-slate-900/50 px-3 py-2 border border-border dark:border-slate-800">
                                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                    <Coins className="h-4 w-4" />
                                    <span className="text-xs font-medium">Credits</span>
                                </div>
                                <span className="text-sm font-bold text-foreground dark:text-white">{user?.credits ?? 0}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative flex flex-col items-center w-full gap-2">
                             <div className="h-10 w-10 rounded-full bg-muted dark:bg-gradient-to-br dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-border dark:border-slate-600/50">
                                <span className="text-sm font-semibold text-foreground dark:text-slate-300">
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            </div>
                            <div className="flex w-full justify-center rounded-lg bg-background dark:bg-slate-900/80 p-1.5 border border-border dark:border-slate-800 text-blue-600 dark:text-blue-400" title={`${user?.credits ?? 0} Credits`}>
                                <Coins className="h-3.5 w-3.5" />
                            </div>
                        </div>
                    )}
                </div>
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
            <div className={cn('mt-auto border-t border-border dark:border-slate-800/80 bg-muted/20 dark:bg-slate-900/50 p-3 flex flex-col gap-1', collapsed ? 'px-2' : 'px-4')}>
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