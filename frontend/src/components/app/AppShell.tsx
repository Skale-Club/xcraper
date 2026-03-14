import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import AppSidebar from '@/components/app/AppSidebar';
import AppTopbar from '@/components/app/AppTopbar';

interface AppShellProps {
    children: ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'xcraper.sidebar.collapsed';

export default function AppShell({ children }: AppShellProps) {
    const { user, signOut } = useAuth();
    const [location] = useLocation();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        setSidebarCollapsed(storedValue === 'true');
    }, []);

    const toggleSidebarCollapsed = () => {
        setSidebarCollapsed((current) => {
            const next = !current;
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
            return next;
        });
    };

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const closeSidebar = () => setMobileSidebarOpen(false);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-300 lg:block',
                    sidebarCollapsed ? 'w-24' : 'w-72',
                )}
            >
                <AppSidebar
                    user={user}
                    collapsed={sidebarCollapsed}
                    showCollapseToggle
                    onLogout={handleLogout}
                    onToggleCollapse={toggleSidebarCollapsed}
                />
            </aside>

            {mobileSidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        aria-label="Close sidebar"
                        className="absolute inset-0 bg-slate-950/50"
                        onClick={closeSidebar}
                    />
                    <aside className="relative h-full w-72 max-w-[85vw]">
                        <AppSidebar
                            user={user}
                            onLogout={handleLogout}
                            onNavigate={closeSidebar}
                        />
                    </aside>
                </div>
            )}

            <div className={cn('transition-[padding] duration-300', sidebarCollapsed ? 'lg:pl-24' : 'lg:pl-72')}>
                <AppTopbar
                    location={location}
                    onOpenSidebar={() => setMobileSidebarOpen(true)}
                />
                <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
            </div>
        </div>
    );
}
