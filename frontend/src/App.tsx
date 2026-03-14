import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect } from 'wouter';
import { Suspense, lazy, type ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import AppShell from '@/components/app/AppShell';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/ThemeProvider';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ContactsPage = lazy(() => import('@/pages/ContactsPage'));
const CreditsPage = lazy(() => import('@/pages/CreditsPage'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const SubscriptionPage = lazy(() => import('@/pages/SubscriptionPage'));
const BillingHistoryPage = lazy(() => import('@/pages/BillingHistoryPage'));
const AdminSettingsPage = lazy(() => import('@/pages/AdminSettingsPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminContactsPage = lazy(() => import('@/pages/AdminContactsPage'));
const AdminTransactionsPage = lazy(() => import('@/pages/AdminTransactionsPage'));

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
        <AppShell>
            <RouteSuspense>{children}</RouteSuspense>
        </AppShell>
    );
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
            <Route path="/">
                <PublicRoute>
                    <LandingPage />
                </PublicRoute>
            </Route>

            <Route path="/login">
                <PublicRoute>
                    <AuthPage />
                </PublicRoute>
            </Route>

            <Route path="/auth/callback">
                <RouteSuspense>
                    <AuthCallbackPage />
                </RouteSuspense>
            </Route>

            <Route path="/auth/reset-password">
                <RouteSuspense>
                    <ResetPasswordPage />
                </RouteSuspense>
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

            <Route path="/contacts">
                <ProtectedRoute>
                    <ContactsPage />
                </ProtectedRoute>
            </Route>

            <Route path="/credits">
                <ProtectedRoute>
                    <CreditsPage />
                </ProtectedRoute>
            </Route>

            <Route path="/pricing">
                <ProtectedRoute>
                    <PricingPage />
                </ProtectedRoute>
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
