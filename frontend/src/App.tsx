import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect, Link, useLocation } from 'wouter';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import {
    Search,
    Database,
    Coins,
    LogOut,
    Menu,
    X,
    Settings,
} from 'lucide-react';
import { Suspense, lazy, useState, type ReactNode } from 'react';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ContactsPage = lazy(() => import('@/pages/ContactsPage'));
const CreditsPage = lazy(() => import('@/pages/CreditsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/AdminSettingsPage'));

const ReactQueryDevtools = import.meta.env.DEV
    ? lazy(async () => {
        const mod = await import('@tanstack/react-query-devtools');
        return { default: mod.ReactQueryDevtools };
    })
    : null;

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
});

// Navigation component for authenticated users
function Navigation() {
    const { user, signOut } = useAuth();
    const [location] = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: Search },
        { path: '/contacts', label: 'Contacts', icon: Database },
        { path: '/credits', label: 'Credits', icon: Coins },
    ];

    // Add admin link for admin users
    if (user?.role === 'admin') {
        navItems.push({ path: '/admin/settings', label: 'Settings', icon: Settings });
    }

    return (
        <header className="bg-white shadow-sm border-b sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="flex items-center gap-3">
                            <span className="text-2xl">🗺️</span>
                            <h1 className="text-xl font-bold text-gray-900">Xcraper</h1>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right side */}
                    <div className="hidden md:flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Coins className="w-4 h-4 text-green-600" />
                            <span className="font-medium">{user?.credits ?? 0} credits</span>
                        </div>
                        <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
                        <Button variant="ghost" size="sm" onClick={handleLogout}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </Button>
                    </div>

                    {/* Mobile menu button */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden py-4 border-t">
                        <nav className="flex flex-col gap-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <div className="border-t my-2" />
                            <div className="flex items-center justify-between px-4 py-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <Coins className="w-4 h-4 text-green-600" />
                                    <span className="font-medium">{user?.credits ?? 0} credits</span>
                                </div>
                            </div>
                            <Button variant="ghost" className="justify-start" onClick={handleLogout}>
                                <LogOut className="w-4 h-4 mr-2" />
                                Logout
                            </Button>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}

function PageFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );
}

function RouteSuspense({ children }: { children: ReactNode }) {
    return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return <PageFallback />;
    }

    if (!isAuthenticated) {
        return <Redirect to="/login" />;
    }

    if (!user?.onboardingCompleted) {
        return <Redirect to="/onboarding" />;
    }

    return (
        <>
            <Navigation />
            <RouteSuspense>{children}</RouteSuspense>
        </>
    );
}

function AdminRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return <PageFallback />;
    }

    if (!isAuthenticated) {
        return <Redirect to="/login" />;
    }

    if (!user?.onboardingCompleted) {
        return <Redirect to="/onboarding" />;
    }

    if (user?.role !== 'admin') {
        return <Redirect to="/dashboard" />;
    }

    return <RouteSuspense>{children}</RouteSuspense>;
}

function PublicRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return <PageFallback />;
    }

    if (isAuthenticated) {
        return <Redirect to={user?.onboardingCompleted ? '/dashboard' : '/onboarding'} />;
    }

    return <RouteSuspense>{children}</RouteSuspense>;
}

function OnboardingRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return <PageFallback />;
    }

    if (!isAuthenticated) {
        return <Redirect to="/login" />;
    }

    if (user?.onboardingCompleted) {
        return <Redirect to="/dashboard" />;
    }

    return <RouteSuspense>{children}</RouteSuspense>;
}

function AppRoutes() {
    return (
        <Switch>
            {/* Landing page - public */}
            <Route path="/">
                <PublicRoute>
                    <LandingPage />
                </PublicRoute>
            </Route>

            {/* Login/Register page - public */}
            <Route path="/login">
                <PublicRoute>
                    <AuthPage />
                </PublicRoute>
            </Route>

            {/* Auth callback for OAuth */}
            <Route path="/auth/callback">
                <RouteSuspense>
                    <AuthCallbackPage />
                </RouteSuspense>
            </Route>

            {/* Reset password - public */}
            <Route path="/auth/reset-password">
                <RouteSuspense>
                    <ResetPasswordPage />
                </RouteSuspense>
            </Route>

            {/* Onboarding - protected (for authenticated users who haven't completed onboarding) */}
            <Route path="/onboarding">
                <OnboardingRoute>
                    <OnboardingPage />
                </OnboardingRoute>
            </Route>

            {/* Dashboard - protected */}
            <Route path="/dashboard">
                <ProtectedRoute>
                    <DashboardPage />
                </ProtectedRoute>
            </Route>

            {/* Contacts - protected */}
            <Route path="/contacts">
                <ProtectedRoute>
                    <ContactsPage />
                </ProtectedRoute>
            </Route>

            {/* Credits - protected */}
            <Route path="/credits">
                <ProtectedRoute>
                    <CreditsPage />
                </ProtectedRoute>
            </Route>

            {/* Admin Settings - admin only */}
            <Route path="/admin/settings">
                <AdminRoute>
                    <AdminSettingsPage />
                </AdminRoute>
            </Route>

            {/* Catch all - redirect to landing */}
            <Route>
                <Redirect to="/" />
            </Route>
        </Switch>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <AppRoutes />
                <Toaster />
            </AuthProvider>
            {ReactQueryDevtools ? (
                <Suspense fallback={null}>
                    <ReactQueryDevtools initialIsOpen={false} />
                </Suspense>
            ) : null}
        </QueryClientProvider>
    );
}

export default App;
