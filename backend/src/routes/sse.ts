import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { searchHistory } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getTaskStatus, type TaskStatus } from '../services/apify.js';
import { syncSearchRecordState } from './search.js';

const TERMINAL_STATUSES = ['completed', 'failed', 'paused'];
const TERMINAL_APIFY_STATUSES = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'];
const HEARTBEAT_INTERVAL_MS = 20000;

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

    const isAdmin = req.user?.role === 'admin';

    // Register this connection
    if (!activeConnections.has(searchId)) {
        activeConnections.set(searchId, new Set());
    }
    activeConnections.get(searchId)!.add(res);

    let pollInterval: NodeJS.Timeout | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let lastStatus = searchRecord.status;
    let lastItemsCount = searchRecord.totalResults || 0;
    let closed = false;

    const cleanup = () => {
        if (closed) return;
        closed = true;
        if (pollInterval) clearInterval(pollInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        const connections = activeConnections.get(searchId);
        if (connections) {
            connections.delete(res);
            if (connections.size === 0) {
                activeConnections.delete(searchId);
            }
        }
        try {
            res.end();
        } catch {
            // Connection might already be closed
        }
    };

    const sendCloseEvent = (reason: string) => {
        if (closed) return;
        try {
            res.write(`event: close\ndata: ${JSON.stringify({ reason })}\n\n`);
        } catch {
            // ignore write failures on a dying connection
        }
        cleanup();
    };

    // Register disconnect handlers before any async work so we never leak.
    req.on('close', cleanup);
    req.socket.on('close', cleanup);
    req.socket.on('error', cleanup);

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

    // Already finished: send the close event immediately instead of leaving the
    // connection (and, formerly, no poller) hanging open forever.
    if (TERMINAL_STATUSES.includes(searchRecord.status)) {
        sendCloseEvent(`Search ${searchRecord.status}`);
        return;
    }

    const pollForUpdates = async () => {
        if (closed) return;
        try {
            let [currentSearch] = await db
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
            if (currentSearch.apifyRunId && !TERMINAL_STATUSES.includes(currentSearch.status)) {
                try {
                    apifyStatus = await getTaskStatus(currentSearch.apifyRunId);
                } catch (error) {
                    console.error('Error fetching Apify status:', error);
                }
            }

            // Drive finalization ourselves when Apify reports a terminal state but
            // the DB row hasn't been finalized. Previously the poller only mirrored
            // the DB, so an SSE-only client would poll forever and the search would
            // never be charged or have its contacts saved.
            if (
                apifyStatus &&
                TERMINAL_APIFY_STATUSES.includes(apifyStatus.status) &&
                !TERMINAL_STATUSES.includes(currentSearch.status)
            ) {
                try {
                    await syncSearchRecordState(currentSearch, userId, isAdmin);
                    const [refreshed] = await db
                        .select()
                        .from(searchHistory)
                        .where(eq(searchHistory.id, searchId))
                        .limit(1);
                    if (refreshed) {
                        currentSearch = refreshed;
                    }
                } catch (error) {
                    console.error('Error finalizing search from SSE poller:', error);
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

            // Stop polling once the search reaches a terminal state.
            if (TERMINAL_STATUSES.includes(currentSearch.status)) {
                sendCloseEvent(`Search ${currentSearch.status}`);
            }
        } catch (error) {
            console.error('Error polling search status:', error);
        }
    };

    // Heartbeat keeps idle connections alive through proxies/load balancers.
    heartbeatInterval = setInterval(() => {
        if (closed) return;
        try {
            res.write(': ping\n\n');
        } catch {
            cleanup();
        }
    }, HEARTBEAT_INTERVAL_MS);

    // Start polling for active searches (every 2 seconds)
    pollInterval = setInterval(pollForUpdates, 2000);
});

export default router;
