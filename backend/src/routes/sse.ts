import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { searchHistory } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getTaskStatus, type TaskStatus } from '../services/apify.js';

const router = Router();

// Store active SSE connections per search
const activeConnections = new Map<string, Set<Response>>();

// Broadcast status update to all connections for a search
export function broadcastSearchUpdate(searchId: string, data: object) {
    const connections = activeConnections.get(searchId);
    if (!connections) return;

    const message = `data: ${JSON.stringify(data)}\n\n`;
    connections.forEach((res) => {
        try {
            res.write(message);
        } catch (error) {
            console.error('Error writing to SSE connection:', error);
        }
    });
}

// Clean up inactive connections
setInterval(() => {
    activeConnections.forEach((connections, searchId) => {
        if (connections.size === 0) {
            activeConnections.delete(searchId);
        }
    });
}, 60000); // Clean up every minute

interface SSEStatusPayload {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    progress?: number;
    itemsCount?: number;
    totalResults?: number | null;
    savedResults?: number | null;
    creditsUsed?: number;
    message?: string;
    completedAt?: string | null;
    apifyStatusMessage?: string | null;
}

// SSE endpoint for real-time search status updates
router.get('/:searchId/stream', requireAuth, async (req, res: Response): Promise<void> => {
    const { searchId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }

    // Verify search belongs to user
    const [searchRecord] = await db
        .select()
        .from(searchHistory)
        .where(and(
            eq(searchHistory.id, searchId),
            eq(searchHistory.userId, userId)
        ))
        .limit(1);

    if (!searchRecord) {
        res.status(404).json({ error: 'Search not found' });
        return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Register this connection
    if (!activeConnections.has(searchId)) {
        activeConnections.set(searchId, new Set());
    }
    activeConnections.get(searchId)!.add(res);

    // Send initial status
    const initialPayload: SSEStatusPayload = {
        status: searchRecord.status as SSEStatusPayload['status'],
        totalResults: searchRecord.totalResults,
        savedResults: searchRecord.savedResults,
        creditsUsed: searchRecord.creditsUsed,
        completedAt: searchRecord.completedAt?.toISOString() || null,
        apifyStatusMessage: searchRecord.apifyStatusMessage,
    };
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

    // Poll for updates if search is active
    let pollInterval: NodeJS.Timeout | null = null;
    let lastStatus = searchRecord.status;
    let lastItemsCount = searchRecord.totalResults || 0;

    const pollForUpdates = async () => {
        try {
            const [currentSearch] = await db
                .select()
                .from(searchHistory)
                .where(eq(searchHistory.id, searchId))
                .limit(1);

            if (!currentSearch) {
                sendCloseEvent('Search not found');
                return;
            }

            // If we have an Apify run ID, get live status
            let apifyStatus: TaskStatus | null = null;
            if (currentSearch.apifyRunId && !['completed', 'failed', 'paused'].includes(currentSearch.status)) {
                try {
                    apifyStatus = await getTaskStatus(currentSearch.apifyRunId);
                } catch (error) {
                    console.error('Error fetching Apify status:', error);
                }
            }

            const payload: SSEStatusPayload = {
                status: currentSearch.status as SSEStatusPayload['status'],
                totalResults: currentSearch.totalResults,
                savedResults: currentSearch.savedResults,
                creditsUsed: currentSearch.creditsUsed,
                completedAt: currentSearch.completedAt?.toISOString() || null,
                apifyStatusMessage: apifyStatus?.statusMessage || currentSearch.apifyStatusMessage,
                itemsCount: apifyStatus?.itemsCount ?? currentSearch.totalResults ?? undefined,
            };

            // Only send if something changed
            if (
                currentSearch.status !== lastStatus ||
                (apifyStatus?.itemsCount || 0) !== lastItemsCount
            ) {
                lastStatus = currentSearch.status;
                lastItemsCount = apifyStatus?.itemsCount || currentSearch.totalResults || 0;
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            }

            // Stop polling if search is complete
            if (['completed', 'failed', 'paused'].includes(currentSearch.status)) {
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
                sendCloseEvent(`Search ${currentSearch.status}`);
            }
        } catch (error) {
            console.error('Error polling search status:', error);
        }
    };

    const sendCloseEvent = (reason: string) => {
        res.write(`event: close\ndata: ${JSON.stringify({ reason })}\n\n`);
        cleanup();
    };

    const cleanup = () => {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        const connections = activeConnections.get(searchId);
        if (connections) {
            connections.delete(res);
            if (connections.size === 0) {
                activeConnections.delete(searchId);
            }
        }
        try {
            res.end();
        } catch (error) {
            // Connection might already be closed
        }
    };

    // Start polling for active searches (every 2 seconds)
    if (!['completed', 'failed', 'paused'].includes(searchRecord.status)) {
        pollInterval = setInterval(pollForUpdates, 2000);
    }

    // Handle client disconnect
    req.on('close', cleanup);
    req.socket.on('close', cleanup);
    req.socket.on('error', cleanup);
});

export default router;
