import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { searchHistory } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// Configuration
const MAX_CONCURRENT_SEARCHES = 3;

/**
 * Count a user's in-flight searches straight from the database, which is the
 * single source of truth. (A previous in-memory counter was never decremented and
 * was wiped wholesale every 60s, so it produced wrong counts and didn't work
 * across serverless instances — it has been removed in favour of this query.)
 */
async function countActiveSearches(userId: string): Promise<number> {
    const [result] = await db.select({
        count: sql<number>`count(*)::int`,
    })
        .from(searchHistory)
        .where(and(
            eq(searchHistory.userId, userId),
            sql`${searchHistory.status} IN ('pending', 'running')`,
        ));

    return result?.count || 0;
}

/**
 * Middleware to limit concurrent searches per user.
 * Prevents users from running too many searches simultaneously.
 */
export async function limitConcurrentSearches(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    try {
        const activeSearches = await countActiveSearches(req.user.id);

        if (activeSearches >= MAX_CONCURRENT_SEARCHES) {
            res.status(429).json({
                error: 'Too many concurrent searches',
                message: `You can only run ${MAX_CONCURRENT_SEARCHES} searches at a time. Please wait for one to complete.`,
                activeSearches,
                maxAllowed: MAX_CONCURRENT_SEARCHES,
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Error checking concurrent searches:', error);
        // Allow request on error (fail open)
        next();
    }
}

/**
 * Get current concurrent searches count for a user.
 */
export async function getUserConcurrentSearches(userId: string): Promise<number> {
    return countActiveSearches(userId);
}
