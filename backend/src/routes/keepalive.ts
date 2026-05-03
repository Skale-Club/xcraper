import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const router = Router();

const KEEPALIVE_SECRET = process.env.KEEPALIVE_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

function verifySecret(req: Request, res: Response): boolean {
    if (!KEEPALIVE_SECRET) {
        logger.warn('KEEPALIVE_SECRET not configured, skipping auth');
        return true;
    }

    const authHeader = req.headers.authorization;
    const querySecret = typeof req.query.secret === 'string' ? req.query.secret : undefined;

    const providedSecret = authHeader?.replace('Bearer ', '') || querySecret;

    if (providedSecret !== KEEPALIVE_SECRET) {
        res.status(401).json({ error: 'Invalid keepalive secret' });
        return false;
    }

    return true;
}

router.get('/', async (req: Request, res: Response) => {
    if (!verifySecret(req, res)) return;

    const results: {
        supabaseRest: { ok: boolean; latencyMs?: number; error?: string; warning?: string };
        database: { ok: boolean; latencyMs?: number; error?: string };
        timestamp: string;
    } = {
        supabaseRest: { ok: false },
        database: { ok: false },
        timestamp: new Date().toISOString(),
    };

    try {
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            // Hit PostgREST: this goes through the full Supabase query stack and
            // generates real database activity, which is what Supabase's free-tier
            // pause detection actually tracks. /auth/v1/health is a GoTrue health
            // check that does NOT touch the database and therefore does NOT reset
            // the 7-day inactivity timer.
            const probeUrl = new URL('/rest/v1/credit_packages?limit=1', SUPABASE_URL).toString();

            const start = Date.now();
            const response = await fetch(probeUrl, {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
            });
            const latency = Date.now() - start;

            // Any HTTP response from Supabase counts: the request reached the gateway.
            // Only network-level errors (caught below) indicate Supabase is unreachable.
            results.supabaseRest = {
                ok: true,
                latencyMs: latency,
                ...(response.ok ? {} : { warning: `${response.status} ${response.statusText}` }),
            };
        } else {
            results.supabaseRest = { ok: false, error: 'Supabase URL or Anon Key not configured' };
        }
    } catch (err) {
        results.supabaseRest = {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }

    try {
        const start = Date.now();
        await db.execute(sql`SELECT 1`);
        const latency = Date.now() - start;

        results.database = { ok: true, latencyMs: latency };
    } catch (err) {
        results.database = {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }

    // Always 200 — the purpose of this endpoint is to generate inbound traffic to
    // Supabase (which resets the free-tier inactivity timer), not to act as a
    // health gate. Returning 503 on probe failure caused the GitHub Actions workflow
    // to fail, creating a circular situation where a paused Supabase prevented the
    // keepalive from waking it back up.
    const status = 200;

    logger.info('Keepalive check', {
        supabaseRest: results.supabaseRest.ok,
        database: results.database.ok,
        status,
    });

    res.status(status).json(results);
});

export default router;
