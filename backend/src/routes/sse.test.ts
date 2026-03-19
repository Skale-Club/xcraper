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

vi.mock('../db/index.js', () => ({
    db: {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(() => ({
                        execute: vi.fn(() => Promise.resolve([{
                            id: 'test-search-id',
                            apifyRunId: 'test-run-id',
                            status: 'running',
                            userId: 'test-user-id',
                            totalResults: 50,
                            savedResults: 25,
                            creditsUsed: 2,
                        }])),
                    })),
                })),
            })),
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    execute: vi.fn(() => Promise.resolve()),
                })),
            })),
        })),
    },
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
        vi.resetAllMocks();
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
