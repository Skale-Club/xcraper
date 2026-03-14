import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Update profile validation
const updateProfileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
});

// Admin: Update user credits
const updateCreditsSchema = z.object({
    credits: z.number().int().min(0, 'Credits cannot be negative'),
});

// Get all users (admin only)
router.get('/', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const allUsers = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            credits: users.credits,
            isActive: users.isActive,
            createdAt: users.createdAt,
        }).from(users);

        res.json({ users: allUsers });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
router.patch('/profile', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const validationResult = updateProfileSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten()
            });
            return;
        }

        const { name, email } = validationResult.data;

        if (email !== undefined && email !== req.user.email) {
            res.status(400).json({
                error: 'Email updates must be handled through Supabase authentication settings',
            });
            return;
        }

        const updateData: { name?: string; updatedAt: Date } = {
            updatedAt: new Date()
        };
        if (name) updateData.name = name;

        const [updatedUser] = await db.update(users)
            .set(updateData)
            .where(eq(users.id, req.user.id))
            .returning();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                role: updatedUser.role,
                credits: updatedUser.credits,
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change password
router.post('/change-password', requireAuth, async (req, res: Response): Promise<void> => {
    res.status(400).json({
        error: 'Password changes must be handled through Supabase auth flows',
    });
});

// Admin: Update user credits
router.patch('/:userId/credits', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const validationResult = updateCreditsSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten()
            });
            return;
        }

        const { credits } = validationResult.data;

        const [updatedUser] = await db.update(users)
            .set({ credits, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();

        if (!updatedUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({
            message: 'Credits updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                credits: updatedUser.credits,
            },
        });
    } catch (error) {
        console.error('Update credits error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Toggle user active status
router.patch('/:userId/status', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            res.status(400).json({ error: 'isActive must be a boolean' });
            return;
        }

        const [updatedUser] = await db.update(users)
            .set({ isActive, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();

        if (!updatedUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                isActive: updatedUser.isActive,
            },
        });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
