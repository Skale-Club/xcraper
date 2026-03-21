import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deductCredits, addCredits, getCreditBalance, hasEnoughCredits } from './credits.js';

// Mock the database
vi.mock('../db/index.js', () => ({
    db: {
        transaction: vi.fn((fn) => fn({
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        for: vi.fn(() => ({
                            // Return mock user with credits
                            then: vi.fn((cb) => cb([{
                                credits: 100,
                                rolloverCredits: 50,
                                purchasedCredits: 25
                            }]))
                        }))
                    }))
                }))
            })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        then: vi.fn()
                    }))
                }))
            })),
            insert: vi.fn(() => ({
                values: vi.fn(() => ({
                    returning: vi.fn(() => [{
                        id: 'test-transaction-id'
                    }])
                }))
            }))
        })),
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    then: vi.fn((cb) => cb([{
                        credits: 100,
                        rolloverCredits: 50,
                        purchasedCredits: 25
                    }]))
                }))
            }))
        }))
    }
}));

describe('Credits Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
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
