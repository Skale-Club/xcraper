import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
    const [, setLocation] = useLocation();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Get the auth code from URL
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                if (code) {
                    // Exchange code for session
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                    if (exchangeError) {
                        throw exchangeError;
                    }
                }

                // Check if we have a session
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    setLocation('/onboarding');
                } else {
                    setError('Authentication failed. Please try again.');
                    setTimeout(() => setLocation('/login'), 3000);
                }
            } catch (err) {
                console.error('Auth callback error:', err);
                setError(err instanceof Error ? err.message : 'Authentication failed');
                setTimeout(() => setLocation('/login'), 3000);
            }
        };

        handleCallback();
    }, [setLocation]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
            >
                {error ? (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">❌</span>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
                        <p className="text-gray-600">{error}</p>
                        <p className="text-sm text-gray-400 mt-4">Redirecting to login...</p>
                    </>
                ) : (
                    <>
                        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Completing sign in...</h2>
                        <p className="text-gray-600">Please wait while we verify your account.</p>
                    </>
                )}
            </motion.div>
        </div>
    );
}
