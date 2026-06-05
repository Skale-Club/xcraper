import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { isXphereConfigured, pushRunToXphere } from '../services/xphere.js';

const router = Router();

// Whether this deployment has the Xphere integration configured.
router.get('/xphere/status', requireAuth, (req, res: Response): void => {
    res.json({ configured: isXphereConfigured() });
});

// Push a completed scrape run's contacts into Xphere as company prospects.
router.post('/xphere/push/:searchId', requireAuth, async (req, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }

    const result = await pushRunToXphere(req.params.searchId, req.user.id);
    if (!result.ok) {
        const status = result.error.includes('not configured') ? 503 : 400;
        res.status(status).json({ error: result.error });
        return;
    }

    res.json({
        message: `Pushed ${result.total} lead(s) to Xphere`,
        ...result,
    });
});

export default router;
