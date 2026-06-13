import { Router, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { isXphereConfiguredForUser, pushRunToXphere } from '../services/xphere.js';

const router = Router();

const DEFAULT_XPHERE_API_URL = 'https://xphere.app';

// ── Xphere integration: per-user API key ────────────────────────────────────────
// Each user stores their own Xphere API key (xph_... with prospects:write) so
// scraped leads push into THEIR Xphere workspace. Configured from the profile panel.

/** Probe a key against Xphere so we reject bad/under-scoped keys at save time.
 *  POST an empty batch: auth + scope are checked BEFORE body validation, so a
 *  valid+scoped key returns 422 (empty batch), 401 = bad token, 403 = no scope. */
async function probeXphereKey(apiUrl: string, apiKey: string): Promise<'ok' | 'unauthorized' | 'forbidden' | 'unreachable'> {
    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/prospects`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prospects: [] }),
        });
        if (res.status === 401) return 'unauthorized';
        if (res.status === 403) return 'forbidden';
        return 'ok';
    } catch {
        return 'unreachable';
    }
}

/** Masked view of a stored key — never returns the full secret. */
function maskKey(key: string): string {
    if (key.length <= 14) return `${key.slice(0, 4)}…`;
    return `${key.slice(0, 12)}…${key.slice(-4)}`;
}

// Whether the current user can push to Xphere (own key, or env fallback).
router.get('/xphere/status', requireAuth, async (req, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    res.json({ configured: await isXphereConfiguredForUser(req.user.id) });
});

// Current user's Xphere integration config (masked — never the full key).
router.get('/xphere/key', requireAuth, async (req, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    const [user] = await db
        .select({ apiKey: users.xphereApiKey, apiUrl: users.xphereApiUrl })
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

    const hasKey = Boolean(user?.apiKey);
    res.json({
        configured: hasKey,
        keyPreview: hasKey ? maskKey(user!.apiKey as string) : null,
        apiUrl: user?.apiUrl || DEFAULT_XPHERE_API_URL,
    });
});

const saveKeySchema = z.object({
    apiKey: z.string().trim().min(8, 'API key looks too short').max(200),
    apiUrl: z.string().trim().url('Must be a valid URL').optional(),
});

// Save / replace the current user's Xphere API key (validated against Xphere first).
router.put('/xphere/key', requireAuth, async (req, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    const parsed = saveKeySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Validation failed' });
        return;
    }
    const apiKey = parsed.data.apiKey;
    const apiUrl = (parsed.data.apiUrl || DEFAULT_XPHERE_API_URL).replace(/\/$/, '');

    const probe = await probeXphereKey(apiUrl, apiKey);
    if (probe === 'unauthorized') {
        res.status(400).json({ error: 'Xphere rejected this key (invalid or revoked).' });
        return;
    }
    if (probe === 'forbidden') {
        res.status(400).json({ error: 'This key is missing the prospects:write scope. Recreate it in Xphere with that scope.' });
        return;
    }

    await db.update(users)
        .set({ xphereApiKey: apiKey, xphereApiUrl: apiUrl, updatedAt: new Date() })
        .where(eq(users.id, req.user.id));

    res.json({
        message: probe === 'unreachable'
            ? 'Saved. (Could not reach Xphere to verify right now — it will be used on the next push.)'
            : 'Xphere API key saved and verified.',
        configured: true,
        keyPreview: maskKey(apiKey),
        apiUrl,
        verified: probe === 'ok',
    });
});

// Remove the current user's Xphere API key.
router.delete('/xphere/key', requireAuth, async (req, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    await db.update(users)
        .set({ xphereApiKey: null, xphereApiUrl: null, updatedAt: new Date() })
        .where(eq(users.id, req.user.id));
    res.json({ message: 'Xphere integration removed.', configured: false });
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
