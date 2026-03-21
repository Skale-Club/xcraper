import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from './auth.js';

// Mock dependencies
vi.mock('../db/index.js', () => ({
    db: {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(() => ({
                        execute: vi.fn(() => Promise.resolve([{
                            id: 'test-user-id',
                            email: 'test@example.com',
                            name: 'Test User',
                            role: 'user',
                            credits: 100
                        }]))
                    }))
                }))
            }))
        })),
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(() => Promise.resolve([{
                    id: 'new-user-id',
                    email: 'new@example.com',
                    name: 'New User',
                    role: 'user',
                    credits: 10
                }]))
            }))
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    execute: vi.fn(() => Promise.resolve())
                }))
            }))
        }))
    }
}));

vi.mock('../middleware/auth.js', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        req.user = { id: 'admin-user-id', email: 'admin@example.com', role: 'admin' };
        next();
    }
}));

describe('Auth Routes', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /me', () => {
        it('should return current user when authenticated', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('email');
        });
    });

    describe('POST /sync', () => {
        it('should sync user from Supabase auth', async () => {
            const response = await request(app)
                .post('/api/auth/sync')
                .send({
                    email: 'new@example.com',
                    name: 'New User'
                });

            // Should return user data
            expect(response.status).toBe(200);
        });
    });

    describe('GET /verify', () => {
        it('should verify token validity', async () => {
            const response = await request(app)
                .get('/api/auth/verify');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('valid', true);
        });
    });
});
