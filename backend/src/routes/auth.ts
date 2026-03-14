import 'dotenv/config';
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db';
import { users, settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Initialize Supabase client for server-side verification
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Warning: Supabase credentials not configured. Auth will not work properly.');
}

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;

// Schema for user sync
const syncUserSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    avatarUrl: z.string().url().optional().nullable(),
});

// Get current user - requires Bearer token from Supabase
router.get('/me', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Verify the token with Supabase
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

        if (error || !supabaseUser) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Get user from our database
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, supabaseUser.id))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found in database' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sync/create user in our database after Supabase auth
router.post('/sync', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Verify the token with Supabase
        const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !supabaseUser) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const userId = supabaseUser.id;
        const body = syncUserSchema.parse(req.body);
        const email = supabaseUser.email ?? body.email;

        // Check if user already exists
        const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (existingUser) {
            // Update existing user
            const [updatedUser] = await db
                .update(users)
                .set({
                    email,
                    name: body.name || existingUser.name,
                    avatarUrl: body.avatarUrl || existingUser.avatarUrl,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, userId))
                .returning();

            return res.json({ user: updatedUser, isNew: false });
        }

        // Get free credits setting
        const [settingsRecord] = await db
            .select()
            .from(settings)
            .limit(1);

        const freeCredits = settingsRecord?.freeCreditsOnSignup ?? 10;

        // Create new user
        const [newUser] = await db
            .insert(users)
            .values({
                id: userId,
                email,
                name: body.name || email.split('@')[0],
                avatarUrl: body.avatarUrl || null,
                role: 'user',
                credits: freeCredits,
            })
            .returning();

        res.status(201).json({ user: newUser, isNew: true });
    } catch (error) {
        console.error('Sync user error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify session (for checking if user is still valid)
router.get('/verify', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ valid: false, error: 'No token provided' });
        }

        const token = authHeader.substring(7);

        if (!supabase) {
            return res.status(500).json({ valid: false, error: 'Supabase not configured' });
        }

        // Verify the token with Supabase
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

        if (error || !supabaseUser) {
            return res.status(401).json({ valid: false, error: 'Invalid token' });
        }

        res.json({ valid: true, userId: supabaseUser.id });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ valid: false, error: 'Internal server error' });
    }
});

// Admin: Get all users
router.get('/admin/users', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Verify the token and check admin role
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

        if (error || !supabaseUser) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check if user is admin
        const [adminUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, supabaseUser.id))
            .limit(1);

        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get all users
        const allUsers = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
                credits: users.credits,
                createdAt: users.createdAt,
            })
            .from(users);

        res.json({ users: allUsers });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
