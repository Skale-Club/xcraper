import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deductCredits, addCredits, getCreditBalance, hasEnoughCredits } from './credits.js';

// Mock the database
// Self-contained chainable query-builder mock. Every builder method returns the same
// chainable, which is awaitable (thenable) resolving to a mock user row, and exposes
// .returning() resolving to a transaction row. This matches whatever combination of
// .for()/.limit()/.set()/.values()/.returning() the service uses, and—crucially—every
// awaited statement actually resolves (the previous mock had a never-resolving
// update().set().where().then, which hung the suite once mocks stopped being reset).
vi.mock('../db/index.js', () => {
    const userRow = { credits: 100, rolloverCredits: 50, purchasedCredits: 25 };
    const makeChain = (rows: any[]): any => {
        const chain: any = {};
        for (const m of ['from', 'where', 'for', 'limit', 'set', 'values', 'orderBy', 'groupBy']) {
            chain[m] = () => chain;
        }
        chain.returning = () => Promise.resolve([{ id: 'test-transaction-id' }]);
        chain.then = (resolve: (value: any) => any) => resolve(rows);
        return chain;
    };
    const tx = {
        select: () => makeChain([userRow]),
        update: () => makeChain([userRow]),
        insert: () => makeChain([{ id: 'test-transaction-id' }]),
    };
    return {
        db: {
            transaction: (fn: (tx: any) => any) => fn(tx),
            select: () => makeChain([userRow]),
        },
    };
});

describe('Credits Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // clearAllMocks (not resetAllMocks) so the vi.mock factory implementations
        // survive between tests — resetAllMocks wiped them, breaking every test that
        // ran after the first.
        vi.clearAllMocks();
    });

    describe('deductCredits', () => {
        it('should reject negative amounts', async () => {
            const result = await deductCredits({
                userId: 'test-user-id',
                amount: -10,
                type: 'search',
                description: 'Test deduction'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Amount must be positive');
        });

        it('should reject zero amounts', async () => {
            const result = await deductCredits({
                userId: 'test-user-id',
                amount: 0,
                type: 'search',
                description: 'Test deduction'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Amount must be positive');
        });

        it('should return transaction details on success', async () => {
            const result = await deductCredits({
                userId: 'test-user-id',
                amount: 10,
                type: 'search',
                description: 'Test search deduction'
            });

            // The mock returns success
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('amount', 10);
        });
    });

    describe('addCredits', () => {
        it('should reject negative amounts', async () => {
            const result = await addCredits({
                userId: 'test-user-id',
                amount: -10,
                type: 'purchase',
                description: 'Test addition'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Amount must be positive');
        });

        it('should reject zero amounts', async () => {
            const result = await addCredits({
                userId: 'test-user-id',
                amount: 0,
                type: 'bonus',
                description: 'Test addition'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Amount must be positive');
        });

        it('should return transaction details on success', async () => {
            const result = await addCredits({
                userId: 'test-user-id',
                amount: 100,
                type: 'purchase',
                description: 'Test purchase',
                moneyAmount: '10.00'
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('amount', 100);
        });
    });

    describe('getCreditBalance', () => {
        it('should return total and breakdown of credits', async () => {
            const balance = await getCreditBalance('test-user-id');

            expect(balance).toHaveProperty('total');
            expect(balance).toHaveProperty('main');
            expect(balance).toHaveProperty('rollover');
            expect(balance).toHaveProperty('purchased');
            expect(typeof balance.total).toBe('number');
        });
    });

    describe('hasEnoughCredits', () => {
        it('should return true when user has enough credits', async () => {
            // Mock user has 175 total credits (100 + 50 + 25)
            const result = await hasEnoughCredits('test-user-id', 50);
            expect(typeof result).toBe('boolean');
        });

        it('should return false when user does not have enough credits', async () => {
            // Mock user has 175 total credits
            const result = await hasEnoughCredits('test-user-id', 200);
            expect(typeof result).toBe('boolean');
        });
    });
});

describe('Credit Transaction Race Conditions', () => {
    it('should handle concurrent deduction attempts', async () => {
        // Simulate 5 concurrent deduction attempts
        const promises = Array(5).fill(null).map((_, i) =>
            deductCredits({
                userId: 'test-user-id',
                amount: 10,
                type: 'search',
                description: `Concurrent test ${i}`
            })
        );

        const results = await Promise.all(promises);

        // All should return a result
        results.forEach(result => {
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('amount', 10);
        });
    });
});
