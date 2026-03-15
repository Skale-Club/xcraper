import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

const optionalString = (max: number, min?: number) =>
    z.preprocess(
        (value) => {
            if (typeof value !== 'string') return value;
            const trimmed = value.trim();
            return trimmed === '' ? undefined : trimmed;
        },
        min
            ? z.string().min(min).max(max).optional()
            : z.string().max(max).optional()
    );

// Validation schema for onboarding data
const onboardingSchema = z.object({
    name: optionalString(100, 2),
    company: optionalString(100),
    phone: optionalString(20),
    step: z.number().int().min(0).optional(),
    completed: z.boolean().optional(),
});

// Get onboarding status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const user = await db
            .select({
                onboardingCompleted: users.onboardingCompleted,
                onboardingStep: users.onboardingStep,
                name: users.name,
                company: users.company,
                phone: users.phone,
            })
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);

        if (!user.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            onboardingCompleted: user[0].onboardingCompleted,
            currentStep: user[0].onboardingStep,
            data: {
                name: user[0].name,
                company: user[0].company,
                phone: user[0].phone,
            },
        });
    } catch (error) {
        console.error('Get onboarding status error:', error);
        res.status(500).json({ error: 'Failed to get onboarding status' });
    }
});

// Update onboarding progress
router.post('/progress', requireAuth, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const validation = onboardingSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                error: 'Invalid data',
                details: validation.error.errors,
            });
        }

        const { step, name, company, phone } = validation.data;

        // Build update object
        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (step !== undefined) {
            updateData.onboardingStep = step;
        }
        if (name !== undefined) {
            updateData.name = name;
        }
        if (company !== undefined) {
            updateData.company = company;
        }
        if (phone !== undefined) {
            updateData.phone = phone;
        }

        await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, req.user.id));

        res.json({
            message: 'Progress saved',
            step: step,
        });
    } catch (error) {
        console.error('Update onboarding progress error:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// Complete onboarding
router.post('/complete', requireAuth, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const validation = onboardingSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                error: 'Invalid data',
                details: validation.error.errors,
            });
        }

        const { name, company, phone } = validation.data;

        // Build update object
        const updateData: Record<string, unknown> = {
            onboardingCompleted: true,
            onboardingStep: 100, // Set to a high number to indicate completion
            updatedAt: new Date(),
        };

        if (name !== undefined) {
            updateData.name = name;
        }
        if (company !== undefined) {
            updateData.company = company;
        }
        if (phone !== undefined) {
            updateData.phone = phone;
        }

        await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, req.user.id));

        res.json({
            message: 'Onboarding completed successfully',
            completed: true,
        });
    } catch (error) {
        console.error('Complete onboarding error:', error);
        res.status(500).json({ error: 'Failed to complete onboarding' });
    }
});

// Skip onboarding
router.post('/skip', requireAuth, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        await db
            .update(users)
            .set({
                onboardingCompleted: true,
                onboardingStep: 100,
                updatedAt: new Date(),
            })
            .where(eq(users.id, req.user.id));

        res.json({
            message: 'Onboarding skipped',
            completed: true,
        });
    } catch (error) {
        console.error('Skip onboarding error:', error);
        res.status(500).json({ error: 'Failed to skip onboarding' });
    }
});

export default router;
