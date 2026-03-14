import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});

// Helper types for Supabase auth
export type SupabaseUser = {
    id: string;
    email: string;
    email_confirmed_at?: string;
    created_at: string;
    user_metadata: {
        name?: string;
        avatar_url?: string;
    };
};

export type AuthError = {
    message: string;
    status?: number;
};
