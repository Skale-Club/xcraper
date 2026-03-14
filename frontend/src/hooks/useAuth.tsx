import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';

// Extended user type with app-specific fields
export interface AppUser {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
    credits: number;
    monthlyCredits?: number;
    rolloverCredits?: number;
    purchasedCredits?: number;
    totalCredits?: number;
    isActive: boolean;
    onboardingCompleted: boolean;
    onboardingStep: number;
    company?: string | null;
    phone?: string | null;
    avatarUrl?: string;
    subscriptionPlanId?: string | null;
    subscriptionStatus?: 'incomplete' | 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    autoTopUpEnabled?: boolean;
    monthlyTopUpCap?: string | null;
    currentMonthTopUpSpend?: string | null;
    topUpThreshold?: number | null;
    createdAt: string;
    updatedAt?: string;
}

interface AuthContextType {
    user: AppUser | null;
    session: Session | null;
    supabaseUser: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; requiresEmailConfirmation: boolean }>;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signInWithGoogle: () => Promise<{ error: string | null }>;
    signInWithGithub: () => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: string | null }>;
    updatePassword: (password: string) => Promise<{ error: string | null }>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Fetch app-specific user data from backend
    const fetchAppUser = useCallback(async (accessToken: string): Promise<AppUser | null> => {
        try {
            const response = await fetch(getApiUrl('/auth/me'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                // User doesn't exist in our database, create them
                if (response.status === 404) {
                    return null;
                }
                throw new Error('Failed to fetch user');
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Error fetching app user:', error);
            return null;
        }
    }, []);

    // Create user in backend database
    const createAppUser = useCallback(async (supabaseUser: User, accessToken: string): Promise<AppUser | null> => {
        try {
            const response = await fetch(getApiUrl('/auth/sync'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    email: supabaseUser.email,
                    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
                    avatarUrl: supabaseUser.user_metadata?.avatar_url,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create user');
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Error creating app user:', error);
            return null;
        }
    }, []);

    const ensureAppUser = useCallback(async (supabaseUser: User, accessToken: string): Promise<AppUser | null> => {
        let appUser = await fetchAppUser(accessToken);

        if (!appUser) {
            appUser = await createAppUser(supabaseUser, accessToken);
        }

        return appUser;
    }, [createAppUser, fetchAppUser]);

    // Initialize auth state
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();

                if (!mounted) return;

                if (initialSession) {
                    setSession(initialSession);
                    setSupabaseUser(initialSession.user);

                    const appUser = await ensureAppUser(initialSession.user, initialSession.access_token);

                    if (mounted) {
                        setUser(appUser);
                    }
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            if (!mounted) return;

            setSession(newSession);
            setSupabaseUser(newSession?.user ?? null);

            if (newSession) {
                const appUser = await ensureAppUser(newSession.user, newSession.access_token);
                setUser(appUser);
            } else {
                setUser(null);
            }

            setIsLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [ensureAppUser]);

    const signUp = async (
        email: string,
        password: string,
        name: string
    ): Promise<{ error: string | null; requiresEmailConfirmation: boolean }> => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                    },
                },
            });

            if (error) {
                return { error: error.message, requiresEmailConfirmation: false };
            }

            if (data.user && !data.session) {
                // Email confirmation required
                toast({
                    title: 'Check your email',
                    description: 'We sent you a confirmation link. Please check your email to verify your account.',
                });
                return { error: null, requiresEmailConfirmation: true };
            }

            return { error: null, requiresEmailConfirmation: false };
        } catch (error) {
            return { error: 'An unexpected error occurred', requiresEmailConfirmation: false };
        }
    };

    const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (error) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const signInWithGoogle = async (): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (error) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const signInWithGithub = async (): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (error) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setSupabaseUser(null);
    };

    const resetPassword = async (email: string): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });

            if (error) {
                return { error: error.message };
            }

            toast({
                title: 'Check your email',
                description: 'We sent you a password reset link.',
            });

            return { error: null };
        } catch (error) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const updatePassword = async (password: string): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                return { error: error.message };
            }

            toast({
                title: 'Password updated',
                description: 'Your password has been changed successfully.',
            });

            return { error: null };
        } catch (error) {
            return { error: 'An unexpected error occurred' };
        }
    };

    const refreshUser = async () => {
        if (session?.access_token && supabaseUser) {
            const appUser = await fetchAppUser(session.access_token);
            setUser(appUser);
        }
    };

    const value: AuthContextType = {
        user,
        session,
        supabaseUser,
        isLoading,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithGithub,
        signOut,
        resetPassword,
        updatePassword,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
