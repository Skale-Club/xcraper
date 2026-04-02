import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const router = Router();

const KEEPALIVE_SECRET = process.env.KEEPALIVE_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_REST_PROBE_TABLE = 'settings';

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
        supabaseRest: { ok: boolean; latencyMs?: number; error?: string };
        database: { ok: boolean; latencyMs?: number; error?: string };
        timestamp: string;
    } = {
        supabaseRest: { ok: false },
        database: { ok: false },
        timestamp: new Date().toISOString(),
    };

    try {
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            });

            const start = Date.now();
            const { error } = await supabase
                .from(SUPABASE_REST_PROBE_TABLE)
                .select('id')
                .limit(1);
            const latency = Date.now() - start;

            if (!error) {
                results.supabaseRest = { ok: true, latencyMs: latency };
            } else {
                results.supabaseRest = { ok: false, latencyMs: latency, error: error.message };
            }
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

    const allOk = results.supabaseRest.ok && results.database.ok;
    const status = allOk ? 200 : 503;

    logger.info('Keepalive check', {
        supabaseRest: results.supabaseRest.ok,
        database: results.database.ok,
        status,
    });

    res.status(status).json(results);
});

export default router;
