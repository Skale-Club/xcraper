import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { creditPackages } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createCheckoutSession, handleSuccessfulPayment, verifyWebhookSignature, handleWebhookEvent } from '../services/stripe';

const router = Router();

// Get available credit packages
router.get('/packages', async (req: Request, res: Response) => {
    try {
        const packages = await db
            .select()
            .from(creditPackages)
            .where(eq(creditPackages.isActive, true));

        res.json({ packages });
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({ error: 'Failed to get packages' });
    }
});

// Create checkout session for credit purchase
router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
    try {
        const { packageId } = req.body;

        if (!packageId) {
            return res.status(400).json({ error: 'Package ID is required' });
        }

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
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to create checkout session'
        });
    }
});

// Verify payment success (for client-side verification)
router.get('/verify/:sessionId', requireAuth, async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const result = await handleSuccessfulPayment(sessionId);

        if (!result) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        res.json({
            message: 'Payment verified successfully',
            credits: result.credits,
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Payment verification failed'
        });
    }
});

// Stripe webhook endpoint (no auth required - verified by signature)
// Note: This needs to be registered with raw body parser in index.ts
router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const signature = req.headers['stripe-signature'] as string;

        if (!signature) {
            return res.status(400).json({ error: 'Missing Stripe signature' });
        }

        // req.body should be raw buffer when using express.raw middleware
        const payload = req.body;

        const event = verifyWebhookSignature(payload, signature);

        if (!event) {
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        await handleWebhookEvent(event);

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Webhook processing failed'
        });
    }
});

export default router;
