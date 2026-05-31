import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import sseRouter from './sse.js';

// Mock dependencies
vi.mock('../services/apify.js', () => ({
    getTaskStatus: vi.fn(() => Promise.resolve({
        id: 'test-run-id',
        status: 'RUNNING',
        statusMessage: 'Processing...',
        itemsCount: 100,
    })),
}));

// Universal chainable query-builder mock that is awaitable (thenable). A terminal
// (completed) search is returned so the SSE handler sends the initial payload + close
// and ends the response deterministically — supertest can't drain an open stream.
vi.mock('../db/index.js', () => {
    const createQueryMock = (rows: Record<string, unknown>[]) => {
        const chainable: Record<string, unknown> = {};
        for (const m of ['from', 'where', 'leftJoin', 'groupBy', 'orderBy', 'limit', 'offset', 'for']) {
            chainable[m] = () => chainable;
        }
        chainable.then = (resolve: (value: unknown) => unknown) => resolve(rows);
        chainable.execute = () => Promise.resolve(rows);
        return chainable;
    };
    const completedSearch = {
        id: 'test-search-id',
        apifyRunId: 'test-run-id',
        status: 'completed',
        userId: 'test-user-id',
        totalResults: 50,
        savedResults: 25,
        creditsUsed: 2,
        completedAt: new Date(),
        apifyStatusMessage: null,
    };
    return {
        db: {
            select: () => createQueryMock([completedSearch]),
            update: () => createQueryMock([]),
        },
    };
});

vi.mock('./search.js', () => ({
    syncSearchRecordState: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../middleware/auth.js', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user-id', role: 'user' };
        next();
    },
}));

describe('SSE Router', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/sse', sseRouter);
        vi.clearAllMocks();
    });

    afterEach(() => {
        // clearAllMocks (not resetAllMocks) so the vi.mock factories survive.
        vi.clearAllMocks();
    });

    describe('GET /:searchId/stream', () => {
        it('should set correct SSE headers for authenticated requests', async () => {
            const response = await request(app)
                .get('/api/sse/test-search-id/stream');

            // SSE requires specific headers
            expect(response.headers['content-type']).toContain('text/event-stream');
            expect(response.headers['cache-control']).toBe('no-cache');
        });

        it('should send initial status on connection', async () => {
            const response = await request(app)
                .get('/api/sse/test-search-id/stream');

            // Should receive some data
            expect(response.status).toBe(200);
        });
    });

    describe('broadcastSearchUpdate', () => {
        it('should be exported as a function', async () => {
            // Import the function
            const { broadcastSearchUpdate } = await import('./sse.js');

            expect(typeof broadcastSearchUpdate).toBe('function');
        });
    });
});
