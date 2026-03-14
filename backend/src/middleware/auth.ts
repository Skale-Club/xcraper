import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Initialize Supabase client for server-side verification
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                name: string;
                role: 'user' | 'admin';
                credits: number;
                avatarUrl?: string | null;
            };
        }
    }
}

// Middleware to verify Supabase token and attach user to request
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);

        if (!supabase) {
            return res.status(500).json({ error: 'Authentication not configured' });
        }

        // Verify the token with Supabase
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

        if (error || !supabaseUser) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Get user from our database
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, supabaseUser.id))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as 'user' | 'admin',
            credits: user.credits,
            avatarUrl: user.avatarUrl,
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Middleware to require admin role
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Optional auth - attaches user if token is present, but doesn't require it
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);

        if (!supabase) {
            return next();
        }

        // Verify the token with Supabase
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

        if (error || !supabaseUser) {
            return next();
        }

        // Get user from our database
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, supabaseUser.id))
            .limit(1);

        if (user) {
            req.user = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role as 'user' | 'admin',
                credits: user.credits,
                avatarUrl: user.avatarUrl,
            };
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
}
