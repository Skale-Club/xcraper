import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { db } from '../db/index.js';
import { searchHistory } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Verify the shared secret Apify sends with each webhook. Configure
 * APIFY_WEBHOOK_SECRET in the environment and add it to the Apify webhook (either
 * as an `x-apify-webhook-secret` header or a `?secret=` query parameter on the
 * target URL). Fails closed: if the secret is not configured the endpoint rejects
 * every request — search state is still finalized by the regular status polling.
 */
function hasValidApifySecret(req: Request): boolean {
    const expected = process.env.APIFY_WEBHOOK_SECRET;
    if (!expected) {
        return false;
    }

    const headerSecret = req.headers['x-apify-webhook-secret'];
    const querySecret = req.query.secret;
    const provided = typeof headerSecret === 'string'
        ? headerSecret
        : typeof querySecret === 'string'
            ? querySecret
            : '';

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
}

// Webhook handler for Apify notifications
// This endpoint is called by Apify when actor runs complete or fail
router.post('/apify', async (req, res: Response): Promise<void> => {
    try {
        if (!hasValidApifySecret(req)) {
            console.warn('⚠️ Rejected Apify webhook with missing/invalid secret');
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { eventType, resource } = req.body ?? {};

        if (!resource || typeof resource.id !== 'string') {
            res.status(400).json({ error: 'Invalid webhook payload' });
            return;
        }

        console.log('📥 Apify webhook received:', {
            eventType,
            actorRunId: resource?.id,
            status: resource?.status,
        });

        // Handle actor run completion
        if (eventType === 'ACTOR.RUN.SUCCEEDED') {
            const runId = resource.id;

            // Find the search record associated with this Apify run
            const [search] = await db.select()
                .from(searchHistory)
                .where(eq(searchHistory.apifyRunId, runId))
                .limit(1);

            if (!search) {
                console.warn(`⚠️ Search not found for Apify run: ${runId}`);
                res.status(404).json({ error: 'Search not found' });
                return;
            }

            console.log(`✅ Processing successful run for search: ${search.id}`);

            // Mark as running if still pending (shouldn't happen, but defensive)
            if (search.status === 'pending') {
                await db.update(searchHistory)
                    .set({ status: 'running' })
                    .where(eq(searchHistory.id, search.id));
            }

            // The actual finalization will be handled by the next polling cycle
            // or by directly calling the status endpoint
            // This webhook just ensures we know the run is complete

            res.status(200).json({
                received: true,
                searchId: search.id,
                message: 'Webhook processed, results will be finalized on next status check'
            });
            return;
        }

        // Handle actor run failure
        if (eventType === 'ACTOR.RUN.FAILED' || eventType === 'ACTOR.RUN.ABORTED' || eventType === 'ACTOR.RUN.TIMED_OUT') {
            const runId = resource.id;

            const [search] = await db.select()
                .from(searchHistory)
                .where(eq(searchHistory.apifyRunId, runId))
                .limit(1);

            if (!search) {
                console.warn(`⚠️ Search not found for failed Apify run: ${runId}`);
                res.status(404).json({ error: 'Search not found' });
                return;
            }

            console.log(`❌ Processing failed run for search: ${search.id}`);

            // Mark as failed
            const newStatus = eventType === 'ACTOR.RUN.ABORTED' ? 'paused' : 'failed';

            await db.update(searchHistory)
                .set({
                    status: newStatus,
                    completedAt: new Date(),
                    apifyStatusMessage: resource.statusMessage || `Run ${eventType}`,
                })
                .where(eq(searchHistory.id, search.id));

            res.status(200).json({
                received: true,
                searchId: search.id,
                status: newStatus
            });
            return;
        }

        // Unknown event type
        console.log(`ℹ️ Unhandled webhook event: ${eventType}`);
        res.status(200).json({ received: true, message: 'Event type not handled' });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({
            error: 'Webhook processing failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Health check endpoint for webhook
router.get('/apify/health', (_req, res: Response): void => {
    res.status(200).json({
        status: 'ok',
        service: 'Apify webhook handler',
        timestamp: new Date().toISOString()
    });
});

export default router;
