import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, searchHistory, type User } from '../db/schema.js';
import { startScrapingTask, isApifyConfigured, type StartedTask } from '../services/apify.js';
import { scraperRegistry } from '../services/scrapers/registry.js';
import { syncSearchRecordState } from './search.js';
import { pushRunToXphere, isXphereConfigured } from '../services/xphere.js';

// Machine-to-machine ("service") API for trusted backends (e.g. the Hermes agent)
// to run a Google Maps scrape and push the results into Xphere WITHOUT a browser
// login. Every other Xcraper route is gated by a Supabase user session; this one
// is gated by a single shared secret (XCRAPER_SERVICE_KEY) instead, and attributes
// the run + credits to a designated service user (XCRAPER_SERVICE_USER_EMAIL, or
// the first admin). It deliberately reuses the same trigger/finalize/push code the
// interactive flow uses, so credits, dedup and storage all behave identically.

const router = Router();

const isTerminal = (s: string): boolean => s === 'completed' || s === 'failed' || s === 'paused';

/** Timing-safe shared-secret check via the `X-Service-Key` header. Fails closed. */
function requireServiceKey(req: Request, res: Response, next: NextFunction): void {
    const expected = process.env.XCRAPER_SERVICE_KEY;
    if (!expected) {
        res.status(503).json({ error: 'Service API is not configured (set XCRAPER_SERVICE_KEY).' });
        return;
    }
    const headerKey = req.headers['x-service-key'];
    const provided = typeof headerKey === 'string' ? headerKey : '';
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
}

/** The user that owns service-triggered runs (and is billed for them). */
async function resolveServiceUser(): Promise<User | null> {
    const email = process.env.XCRAPER_SERVICE_USER_EMAIL;
    if (email) {
        const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (u) return u;
    }
    const [admin] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    return admin ?? null;
}

const scrapeSchema = z.object({
    query: z.string().min(2).max(500),
    location: z.string().min(2).max(500),
    maxResults: z.number().int().min(1).max(1000).optional().default(50),
    // 'standard' = Google Maps business listings; 'enriched' = + email extraction.
    scrapeType: z.enum(['standard', 'enriched']).optional().default('standard'),
});

/** Push a finished run's contacts into Xphere; uniform shape for the JSON response. */
async function pushToXphere(searchId: string, userId: string): Promise<Record<string, unknown>> {
    if (!isXphereConfigured()) {
        return { pushed: false, error: 'Xphere not configured (set XPHERE_API_KEY).' };
    }
    const result = await pushRunToXphere(searchId, userId);
    return result.ok ? { pushed: true, ...result } : { pushed: false, error: result.error };
}

// POST /api/service/scrape — kick off a Google Maps scrape. Returns immediately
// with a searchId (the Apify run is async); poll the GET endpoint until completed.
router.post('/scrape', requireServiceKey, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = scrapeSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
            return;
        }
        const { query, location, maxResults, scrapeType } = parsed.data;

        if (!isApifyConfigured()) {
            res.status(503).json({ error: 'Scraping service is not configured.' });
            return;
        }

        const template = scraperRegistry.getTemplate(scrapeType);
        if (!template) {
            res.status(400).json({ error: `Unknown scraper type "${scrapeType}".` });
            return;
        }
        const { runtime } = await scraperRegistry.resolve(scrapeType);
        if (!runtime.isActive) {
            res.status(400).json({ error: `${template.label} is currently disabled.` });
            return;
        }

        const user = await resolveServiceUser();
        if (!user) {
            res.status(500).json({ error: 'No service user found (set XCRAPER_SERVICE_USER_EMAIL or create an admin).' });
            return;
        }
        if (user.accountRiskFlag === 'suspended' || user.accountRiskFlag === 'restricted') {
            res.status(403).json({ error: 'Service account is restricted.' });
            return;
        }

        const maxR = Math.min(Math.max(maxResults, runtime.minResults), runtime.maxResults);

        const [searchRecord] = await db.insert(searchHistory).values({
            userId: user.id,
            query: query.trim(),
            location: location.trim(),
            requestedMaxResults: maxR,
            requestEnrichment: template.extractsEmails,
            scrapeType: template.key,
            searchFilters: null,
            status: 'pending',
            creditsUsed: 0,
            standardResultsCount: template.extractsEmails ? null : 0,
            enrichedResultsCount: template.extractsEmails ? 0 : null,
        }).returning();

        let startedTask: StartedTask;
        try {
            startedTask = await startScrapingTask(template.key, {
                maxResults: maxR,
                language: '',
                countryCode: '',
                query,
                location,
                filters: undefined,
            });
            await db.update(searchHistory)
                .set({
                    apifyRunId: startedTask.runId,
                    apifyActorId: startedTask.actorId,
                    apifyActorName: startedTask.actorName,
                    apifyInput: startedTask.input,
                    status: 'running',
                    ...(startedTask.datasetId ? { apifyDatasetId: startedTask.datasetId } : {}),
                    ...(startedTask.containerUrl ? { apifyContainerUrl: startedTask.containerUrl } : {}),
                    ...(startedTask.startedAt ? { apifyStartedAt: startedTask.startedAt } : {}),
                })
                .where(eq(searchHistory.id, searchRecord.id));
        } catch (apifyError) {
            const msg = apifyError instanceof Error ? apifyError.message : 'Failed to start search';
            await db.update(searchHistory)
                .set({ status: 'failed', errorMessage: msg, apifyStatusMessage: msg, failedAt: new Date(), completedAt: new Date() })
                .where(eq(searchHistory.id, searchRecord.id));
            throw apifyError;
        }

        res.status(202).json({
            searchId: searchRecord.id,
            status: 'running',
            scrapeType: template.key,
            query: query.trim(),
            location: location.trim(),
            maxResults: maxR,
            apifyRunId: startedTask.runId,
            poll: `/api/service/scrape/${searchRecord.id}`,
            hint: 'Poll the `poll` URL every ~20s until status is "completed"; the response then includes the Xphere push result.',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to start scrape', message });
    }
});

// GET /api/service/scrape/:id — poll status. When the Apify run first finishes,
// results are finalized (contacts saved, credits charged) and auto-pushed to
// Xphere; the push result is returned. Safe to keep polling — the push only fires
// on the finalizing transition, not on every call.
router.get('/scrape/:id', requireServiceKey, async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await resolveServiceUser();
        if (!user) {
            res.status(500).json({ error: 'No service user found.' });
            return;
        }
        const [record] = await db.select()
            .from(searchHistory)
            .where(and(eq(searchHistory.id, req.params.id), eq(searchHistory.userId, user.id)))
            .limit(1);
        if (!record) {
            res.status(404).json({ error: 'Search not found.' });
            return;
        }

        const wasTerminalBefore = isTerminal(record.status);
        const isAdmin = user.role === 'admin';
        const payload = await syncSearchRecordState(record, user.id, isAdmin);

        // Push exactly once: only on the poll that flips the run to completed.
        let xphere: Record<string, unknown> = { pushed: false };
        if (payload.status === 'completed') {
            xphere = wasTerminalBefore
                ? { pushed: false, note: 'Already finalized on an earlier poll. POST /push to re-send.' }
                : await pushToXphere(record.id, user.id);
        }

        res.json({
            searchId: record.id,
            status: payload.status,
            savedResults: payload.savedResults ?? null,
            totalResults: payload.totalResults ?? null,
            progress: payload.progress ?? null,
            itemsCount: payload.itemsCount ?? null,
            apifyStatusMessage: payload.apifyStatusMessage ?? null,
            xphere,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to read scrape status', message });
    }
});

// POST /api/service/scrape/:id/push — force a (re)push to Xphere. Idempotent on the
// Xphere side (dedup by Google Place id). Useful if the auto-push failed.
router.post('/scrape/:id/push', requireServiceKey, async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await resolveServiceUser();
        if (!user) {
            res.status(500).json({ error: 'No service user found.' });
            return;
        }
        const [record] = await db.select()
            .from(searchHistory)
            .where(and(eq(searchHistory.id, req.params.id), eq(searchHistory.userId, user.id)))
            .limit(1);
        if (!record) {
            res.status(404).json({ error: 'Search not found.' });
            return;
        }
        if (record.status !== 'completed') {
            res.status(409).json({ error: `Run is "${record.status}", not completed — nothing to push yet.` });
            return;
        }
        const xphere = await pushToXphere(record.id, user.id);
        res.json({ searchId: record.id, xphere });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to push to Xphere', message });
    }
});

export default router;
