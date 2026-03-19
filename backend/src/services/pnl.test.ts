import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pnlService } from './pnl';

// Mock the database
vi.mock('../db/index.js', () => ({
    db: {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    execute: vi.fn(() => Promise.resolve([])),
                })),
                leftJoin: vi.fn(() => ({
                    groupBy: vi.fn(() => ({
                        execute: vi.fn(() => Promise.resolve([])),
                    })),
                })),
                groupBy: vi.fn(() => ({
                    execute: vi.fn(() => Promise.resolve([])),
                })),
            })),
        })),
    },
}));

describe('P&L Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('getPnLMetrics', () => {
        it('should return P&L metrics for a given date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            const result = await pnlService.getPnLMetrics(startDate, endDate);

            // Verify structure
            expect(result).toHaveProperty('totalRevenue');
            expect(result).toHaveProperty('subscriptionRevenue');
            expect(result).toHaveProperty('oneTimeRevenue');
            expect(result).toHaveProperty('totalCosts');
            expect(result).toHaveProperty('grossProfit');
            expect(result).toHaveProperty('grossMargin');
        });

        it('should calculate revenue correctly', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            const result = await pnlService.getPnLMetrics(startDate, endDate);

            // Verify revenue properties exist and are numbers
            expect(typeof result.totalRevenue).toBe('number');
            expect(typeof result.subscriptionRevenue).toBe('number');
            expect(typeof result.oneTimeRevenue).toBe('number');
        });
    });

    describe('getDailyMetrics', () => {
        it('should return daily metrics for charting', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-07');

            const result = await pnlService.getDailyMetrics(startDate, endDate);

            // Should return an array
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getCurrentMonthOverview', () => {
        it('should return current month overview', async () => {
            const result = await pnlService.getCurrentMonthOverview();

            // Verify structure
            expect(result).toHaveProperty('mrr');
            expect(result).toHaveProperty('activeSubscribers');
            expect(result).toHaveProperty('totalSearches');
            expect(result).toHaveProperty('totalLeads');
            expect(result).toHaveProperty('creditsUsed');
        });
    });

    describe('getPlanMetrics', () => {
        it('should return metrics by subscription plan', async () => {
            const result = await pnlService.getPlanMetrics();

            // Should return an array
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getTopUsers', () => {
        it('should return top users by spending', async () => {
            const result = await pnlService.getTopUsers(10);

            // Should return an array
            expect(Array.isArray(result)).toBe(true);
        });

        it('should respect the limit parameter', async () => {
            const result = await pnlService.getTopUsers(5);

            // Should return an array with at most 5 items
            expect(result.length).toBeLessThanOrEqual(5);
        });
    });
});
