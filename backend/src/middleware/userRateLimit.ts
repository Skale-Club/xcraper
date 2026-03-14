import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { searchHistory } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// In-memory store for concurrent search tracking
const userConcurrentSearches = new Map<string, number>();

// Configuration
const MAX_CONCURRENT_SEARCHES = 3;
const CLEANUP_INTERVAL_MS = 60000; // 1 minute

// Cleanup stale entries periodically
setInterval(() => {
    userConcurrentSearches.clear();
}, CLEANUP_INTERVAL_MS);

/**
 * Middleware to limit concurrent searches per user
 * Prevents users from running too many searches simultaneously
 */
export async function limitConcurrentSearches(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const userId = req.user.id;

    try {
        // Count active searches from database (source of truth)
        const [result] = await db.select({
            count: sql<number>`count(*)::int`
        })
            .from(searchHistory)
            .where(and(
                eq(searchHistory.userId, userId),
                sql`${searchHistory.status} IN ('pending', 'running')`
            ));

        const activeSearches = result?.count || 0;

        // Update in-memory cache
        userConcurrentSearches.set(userId, activeSearches);

        // Check limit
        if (activeSearches >= MAX_CONCURRENT_SEARCHES) {
            res.status(429).json({
                error: 'Too many concurrent searches',
                message: `You can only run ${MAX_CONCURRENT_SEARCHES} searches at a time. Please wait for one to complete.`,
                activeSearches,
                maxAllowed: MAX_CONCURRENT_SEARCHES
            });
            return;
        }

        // Allow the request to proceed
        next();
    } catch (error) {
        console.error('Error checking concurrent searches:', error);
        // Allow request on error (fail open)
        next();
    }
}

/**
 * Get current concurrent searches count for a user
 */
export async function getUserConcurrentSearches(userId: string): Promise<number> {
    // Try cache first
    const cached = userConcurrentSearches.get(userId);
    if (cached !== undefined) {
        return cached;
    }

    // Fall back to database
    const [result] = await db.select({
        count: sql<number>`count(*)::int`
    })
        .from(searchHistory)
        .where(and(
            eq(searchHistory.userId, userId),
            sql`${searchHistory.status} IN ('pending', 'running')`
        ));

    const count = result?.count || 0;
    userConcurrentSearches.set(userId, count);

    return count;
}

/**
 * Decrement user's concurrent search count (call when search completes)
 */
export function decrementUserSearchCount(userId: string): void {
    const current = userConcurrentSearches.get(userId) || 0;
    if (current > 0) {
        userConcurrentSearches.set(userId, current - 1);
    }
}

/**
 * Increment user's concurrent search count (call when search starts)
 */
export function incrementUserSearchCount(userId: string): void {
    const current = userConcurrentSearches.get(userId) || 0;
    userConcurrentSearches.set(userId, current + 1);
}
