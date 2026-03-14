import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { searchHistory } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getTaskResults } from '../services/apify.js';

const router = Router();

// Webhook handler for Apify notifications
// This endpoint is called by Apify when actor runs complete or fail
router.post('/apify', async (req, res: Response): Promise<void> => {
    try {
        const { eventType, eventData, resource } = req.body;

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
