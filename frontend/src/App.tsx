import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect } from 'wouter';
import { Suspense, lazy, type ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import AppShell from '@/components/app/AppShell';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SettingsLayout } from '@/pages/admin/settings';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const SearchesPage = lazy(() => import('@/pages/SearchesPage'));
const BillingPage = lazy(() => import('@/pages/BillingPage'));
const SubscriptionPage = lazy(() => import('@/pages/SubscriptionPage'));
const BillingHistoryPage = lazy(() => import('@/pages/BillingHistoryPage'));
const AdminSettingsPage = lazy(() => import('@/pages/AdminSettingsPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminContactsPage = lazy(() => import('@/pages/AdminContactsPage'));
const AdminTransactionsPage = lazy(() => import('@/pages/AdminTransactionsPage'));
const AdminSearchesPage = lazy(() => import('@/pages/AdminSearchesPage'));
const AdminSettingsBrandingPage = lazy(() => import('@/pages/admin/settings/BrandingPage'));
const AdminSettingsSEOPage = lazy(() => import('@/pages/admin/settings/SEOPage'));
const AdminSettingsContentPage = lazy(() => import('@/pages/admin/settings/ContentPage'));
const AdminSettingsPricingPage = lazy(() => import('@/pages/admin/settings/PricingPage'));
const AdminSettingsAdvancedPage = lazy(() => import('@/pages/admin/settings/AdvancedPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

const ReactQueryDevtools = import.meta.env.DEV
    ? lazy(async () => {
        const mod = await import('@tanstack/react-query-devtools');
        return { default: mod.ReactQueryDevtools };
    })
    : null;

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
        },
    },
});

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
        <AppShell>
            <RouteSuspense>{children}</RouteSuspense>
        </AppShell>
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

    return (
        <div className="force-dark">
            <AppShell>
                <RouteSuspense>{children}</RouteSuspense>
            </AppShell>
        </div>
    );
}

type SettingsPage = 'branding' | 'seo' | 'content' | 'pricing' | 'advanced';

function SettingsLayoutWrapper({ page, children }: { page: SettingsPage; children: ReactNode }) {
    return (
        <Suspense fallback={<PageFallback />}>
            <SettingsLayout currentPage={page}>
                {children}
            </SettingsLayout>
        </Suspense>
    );
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
            <Route path="/">
                <div className="force-dark min-h-screen bg-background text-foreground">
                    <RouteSuspense>
                        <LandingPage />
                    </RouteSuspense>
                </div>
            </Route>

            <Route path="/login">
                <div className="force-dark min-h-screen bg-background text-foreground">
                    <RouteSuspense>
                        <AuthPage />
                    </RouteSuspense>
                </div>
            </Route>

            <Route path="/auth/callback">
                <div className="force-light min-h-screen bg-background text-foreground">
                    <RouteSuspense>
                        <AuthCallbackPage />
                    </RouteSuspense>
                </div>
            </Route>

            <Route path="/auth/reset-password">
                <div className="force-light min-h-screen bg-background text-foreground">
                    <RouteSuspense>
                        <ResetPasswordPage />
                    </RouteSuspense>
                </div>
            </Route>

            <Route path="/terms">
                <RouteSuspense>
                    <TermsPage />
                </RouteSuspense>
            </Route>

            <Route path="/privacy">
                <RouteSuspense>
                    <PrivacyPage />
                </RouteSuspense>
            </Route>

            <Route path="/onboarding">
                <OnboardingRoute>
                    <OnboardingPage />
                </OnboardingRoute>
            </Route>

            <Route path="/dashboard">
                <ProtectedRoute>
                    <DashboardPage />
                </ProtectedRoute>
            </Route>

            <Route path="/searches">
                <ProtectedRoute>
                    <SearchesPage />
                </ProtectedRoute>
            </Route>

            <Route path="/billing">
                <ProtectedRoute>
                    <BillingPage />
                </ProtectedRoute>
            </Route>

            <Route path="/pricing">
                <Redirect to="/billing" />
            </Route>

            <Route path="/subscription">
                <ProtectedRoute>
                    <SubscriptionPage />
                </ProtectedRoute>
            </Route>

            <Route path="/billing-history">
                <ProtectedRoute>
                    <BillingHistoryPage />
                </ProtectedRoute>
            </Route>

            <Route path="/profile">
                <ProtectedRoute>
                    <ProfilePage />
                </ProtectedRoute>
            </Route>

            <Route path="/admin/settings">
                <AdminRoute>
                    <AdminSettingsPage />
                </AdminRoute>
            </Route>

            <Route path="/admin">
                <AdminRoute>
                    <AdminDashboardPage />
                </AdminRoute>
            </Route>

            <Route path="/admin/users">
                <AdminRoute>
                    <AdminUsersPage />
                </AdminRoute>
            </Route>

            <Route path="/admin/contacts">
                <AdminRoute>
                    <AdminContactsPage />
                </AdminRoute>
            </Route>

            <Route path="/admin/transactions">
                <AdminRoute>
                    <AdminTransactionsPage />
                </AdminRoute>
            </Route>

            <Route path="/admin/searches">
                <AdminRoute>
                    <AdminSearchesPage />
                </AdminRoute>
            </Route>

            <Route path="/admin/settings">
                <AdminRoute>
                    <Redirect to="/admin/settings/branding" />
                </AdminRoute>
            </Route>

            <Route path="/admin/settings/branding">
                <AdminRoute>
                    <SettingsLayoutWrapper page="branding">
                        <AdminSettingsBrandingPage />
                    </SettingsLayoutWrapper>
                </AdminRoute>
            </Route>

            <Route path="/admin/settings/seo">
                <AdminRoute>
                    <SettingsLayoutWrapper page="seo">
                        <AdminSettingsSEOPage />
                    </SettingsLayoutWrapper>
                </AdminRoute>
            </Route>

            <Route path="/admin/settings/content">
                <AdminRoute>
                    <SettingsLayoutWrapper page="content">
                        <AdminSettingsContentPage />
                    </SettingsLayoutWrapper>
                </AdminRoute>
            </Route>

            <Route path="/admin/settings/pricing">
                <AdminRoute>
                    <SettingsLayoutWrapper page="pricing">
                        <AdminSettingsPricingPage />
                    </SettingsLayoutWrapper>
                </AdminRoute>
            </Route>

            <Route path="/admin/settings/advanced">
                <AdminRoute>
                    <SettingsLayoutWrapper page="advanced">
                        <AdminSettingsAdvancedPage />
                    </SettingsLayoutWrapper>
                </AdminRoute>
            </Route>

            <Route>
                <Redirect to="/" />
            </Route>
        </Switch>
    );
}

function App() {
    return (
        <ThemeProvider defaultTheme="system" storageKey="xcraper-theme">
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
        </ThemeProvider>
    );
}

export default App;
