import { Router, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { pnlService } from '../services/pnl.js';

const router = Router();

/**
 * GET /api/pnl/overview
 * Get current month overview with MRR, active users, searches, and revenue
 */
router.get('/overview', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const overview = await pnlService.getCurrentMonthOverview();
        res.json({ data: overview });
    } catch (error) {
        console.error('Error fetching P&L overview:', error);
        res.status(500).json({ error: 'Failed to fetch P&L overview' });
    }
});

/**
 * GET /api/pnl/metrics
 * Get P&L metrics for a date range
 * Query params: startDate, endDate (optional, defaults to current month)
 */
router.get('/metrics', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        let startDate = startOfMonth;
        let endDate = endOfMonth;

        if (req.query.startDate && typeof req.query.startDate === 'string') {
            startDate = new Date(req.query.startDate);
        }
        if (req.query.endDate && typeof req.query.endDate === 'string') {
            endDate = new Date(req.query.endDate);
        }

        if (startDate > endDate) {
            res.status(400).json({ error: 'Start date must be before end date' });
            return;
        }

        const metrics = await pnlService.getPnLMetrics(startDate, endDate);
        res.json({ data: metrics });
    } catch (error) {
        console.error('Error fetching P&L metrics:', error);
        res.status(500).json({ error: 'Failed to fetch P&L metrics' });
    }
});

/**
 * GET /api/pnl/daily
 * Get daily metrics for charting
 * Query params: startDate, endDate (optional, defaults to last 30 days)
 */
router.get('/daily', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let startDate = thirtyDaysAgo;
        let endDate = now;

        if (req.query.startDate && typeof req.query.startDate === 'string') {
            startDate = new Date(req.query.startDate);
        }
        if (req.query.endDate && typeof req.query.endDate === 'string') {
            endDate = new Date(req.query.endDate);
        }

        if (startDate > endDate) {
            res.status(400).json({ error: 'Start date must be before end date' });
            return;
        }

        const dailyMetrics = await pnlService.getDailyMetrics(startDate, endDate);
        res.json({ data: dailyMetrics });
    } catch (error) {
        console.error('Error fetching daily metrics:', error);
        res.status(500).json({ error: 'Failed to fetch daily metrics' });
    }
});

/**
 * GET /api/pnl/plans
 * Get metrics by subscription plan
 */
router.get('/plans', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const planMetrics = await pnlService.getPlanMetrics();
        res.json({ data: planMetrics });
    } catch (error) {
        console.error('Error fetching plan metrics:', error);
        res.status(500).json({ error: 'Failed to fetch plan metrics' });
    }
});

/**
 * GET /api/pnl/top-users
 * Get top users by spending
 * Query params: limit (optional, defaults to 10)
 */
router.get('/top-users', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const topUsers = await pnlService.getTopUsers(limit);
        res.json({ data: topUsers });
    } catch (error) {
        console.error('Error fetching top users:', error);
        res.status(500).json({ error: 'Failed to fetch top users' });
    }
});

export default router;
