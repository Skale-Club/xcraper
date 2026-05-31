import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from './auth.js';

// auth.ts only builds its Supabase client when these env vars are present, and it
// reads them at module-eval time — so they must be set before the import is
// evaluated. vi.hoisted runs before the (hoisted) imports.
vi.hoisted(() => {
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

// Mock the Supabase client so token verification returns a fixed user.
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: 'test-user-id', email: 'test@example.com' } },
                error: null,
            })),
        },
    }),
}));

// Self-contained chainable query-builder mock (awaitable, with .returning()).
vi.mock('../db/index.js', () => {
    const userRow = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        credits: 100,
        rolloverCredits: 0,
        purchasedCredits: 0,
        isActive: true,
        onboardingCompleted: false,
        onboardingStep: 0,
        company: null,
        phone: null,
        avatarUrl: null,
        subscriptionPlanId: null,
        subscriptionStatus: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        autoTopUpEnabled: true,
        monthlyTopUpCap: null,
        currentMonthTopUpSpend: null,
        topUpThreshold: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const makeChain = (rows: any[]): any => {
        const chain: any = {};
        for (const m of ['from', 'where', 'limit', 'set', 'values', 'orderBy', 'for', 'groupBy']) {
            chain[m] = () => chain;
        }
        chain.returning = () => Promise.resolve(rows);
        chain.then = (resolve: (value: any) => any) => resolve(rows);
        return chain;
    };
    return {
        db: {
            select: () => makeChain([userRow]),
            insert: () => makeChain([userRow]),
            update: () => makeChain([userRow]),
        },
    };
});

vi.mock('../middleware/auth.js', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
        next();
    },
    requireAdmin: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin-user-id', email: 'admin@example.com', role: 'admin' };
        next();
    },
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
        // clearAllMocks (not resetAllMocks) so the vi.mock factories survive.
        vi.clearAllMocks();
    });

    describe('GET /me', () => {
        it('should return current user when authenticated', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer test-token');

            expect(response.status).toBe(200);
            expect(response.body.user).toHaveProperty('id');
            expect(response.body.user).toHaveProperty('email');
        });
    });

    describe('POST /sync', () => {
        it('should sync user from Supabase auth', async () => {
            const response = await request(app)
                .post('/api/auth/sync')
                .set('Authorization', 'Bearer test-token')
                .send({
                    email: 'new@example.com',
                    name: 'New User',
                });

            // Should return user data
            expect(response.status).toBe(200);
        });
    });

    describe('GET /verify', () => {
        it('should verify token validity', async () => {
            const response = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', 'Bearer test-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('valid', true);
        });
    });
});
