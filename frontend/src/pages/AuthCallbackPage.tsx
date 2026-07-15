import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

export default function AuthCallbackPage() {
    const [, setLocation] = useLocation();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let done = false;
        let redirectTimeout: ReturnType<typeof setTimeout> | undefined;

        const finish = (session: Session | null) => {
            if (done) return;
            done = true;
            if (session) {
                setLocation('/dashboard');
            } else {
                setError('Authentication failed. Please try again.');
                redirectTimeout = setTimeout(() => setLocation('/login'), 3000);
            }
        };

        // Provider denied/cancelled (e.g. ?error=access_denied) — fail fast instead
        // of waiting for the session timeout below.
        const params = new URLSearchParams(window.location.search);
        if (params.get('error')) {
            finish(null);
            return () => clearTimeout(redirectTimeout);
        }

        // GoTrue (detectSessionInUrl) exchanges the code/hash on load; getSession()
        // resolves only after that completes.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) finish(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) finish(session);
        });

        const timeout = setTimeout(() => finish(null), 10000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
            clearTimeout(redirectTimeout);
        };
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
