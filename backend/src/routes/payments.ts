import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users, creditPackages } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createCheckoutSession, handleSuccessfulPayment, verifyWebhookSignature, handleWebhookEvent, createPortalSession } from '../services/stripe.js';
import { z } from 'zod';

const router = Router();

router.get('/packages', async (req: Request, res: Response) => {
    try {
        const packages = await db
            .select()
            .from(creditPackages)
            .where(eq(creditPackages.isActive, true));

        res.json({ packages });
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500). json({ error: 'Failed to get packages' });
    }
});

const checkoutSchema = z.object({
    packageId: z.string().uuid(),
});

router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
    try {
        const { packageId } = checkoutSchema.parse(req.body);

        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const result = await createCheckoutSession(
            req.user.id,
            req.user.email,
            packageId
        );

        if (!result) {
            return res.status(500).json({ error: 'Failed to create checkout session' });
        }

        res.json({
            message: 'Checkout session created',
            sessionId: result.sessionId,
            url: result.url,
        });
    } catch (error) {
        console.error('Checkout error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to create checkout session'
        });
    }
});

router.get('/verify/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400). json({ error: 'Session ID is required' });
        }

        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const result = await handleSuccessfulPayment(sessionId);

        if (!result) {
            return res.status(400). json({ error: 'Payment verification failed' });
        }

        if (result.userId !== req.user.id) {
            return res.status(403).json({ error: 'Payment session does not belong to the authenticated user' });
        }

        res.json({
            message: 'Payment verified successfully',
            credits: result.credits,
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500). json({
            error: error instanceof Error ? error.message : 'Payment verification failed'
        });
    }
});

router.post('/portal', requireAuth, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401). json({ error: 'User not authenticated' });
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);

        if (!user || !user.stripeCustomerId) {
            return res.status(400). json({ error: 'No Stripe customer ID' });
        }

        const result = await createPortalSession(user.stripeCustomerId);

        if (!result) {
            return res.status(500). json({ error: 'Failed to create portal session' });
        }

        res.json({ url: result.url });
    } catch (error) {
        console.error('Portal error:', error);
        res.status(500). json({
            error: error instanceof Error ? error.message : 'Failed to create portal session'
        });
    }
});

router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const signature = req.headers['stripe-signature'] as string;

        if (!signature) {
            return res.status(400).json({ error: 'Missing Stripe signature' });
        }

        const payload = req.body;

        const event = verifyWebhookSignature(payload, signature);

        if (!event) {
            return res.status(400). json({ error: 'Invalid webhook signature' });
        }

        await handleWebhookEvent(event);

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500). json({
            error: error instanceof Error ? error.message : 'Webhook processing failed'
        });
    }
});

export default router;
