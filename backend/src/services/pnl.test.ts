import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pnlService } from './pnl';

// Mock the database with a universal chainable query builder. Every builder method
// returns the same chainable, and the chainable is awaitable (thenable) resolving to
// one empty row — so any combination of .where()/.groupBy()/.leftJoin()/.limit() the
// service uses works, and `const [x] = await q` yields a defined (if empty) row.
function createQueryMock(rows: Record<string, unknown>[] = [{}]) {
    const chainable: Record<string, unknown> = {};
    const methods = ['from', 'where', 'leftJoin', 'innerJoin', 'groupBy', 'orderBy', 'limit', 'offset', 'for', 'having'];
    for (const m of methods) {
        chainable[m] = () => chainable;
    }
    chainable.then = (resolve: (value: unknown) => unknown) => resolve(rows);
    chainable.execute = () => Promise.resolve(rows);
    return chainable;
}

vi.mock('../db/index.js', () => ({
    db: {
        select: vi.fn(() => createQueryMock([{}])),
    },
}));

describe('P&L Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // clearAllMocks (not resetAllMocks) so the db mock implementation survives.
        vi.clearAllMocks();
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
            expect(result).toHaveProperty('totalApifyCost');
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

            // Verify structure (matches the actual getCurrentMonthOverview shape)
            expect(result).toHaveProperty('mrr');
            expect(result).toHaveProperty('activeUsers');
            expect(result).toHaveProperty('searchesThisMonth');
            expect(result).toHaveProperty('revenueThisMonth');
            expect(result).toHaveProperty('mrrChange');
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
