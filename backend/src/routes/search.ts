import { Router, Response } from 'express';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import { db } from '../db/index.js';
import {
    users,
    searchHistory,
    contacts,
    creditTransactions,
    billingEvents,
    subscriptionPlans,
    type SearchHistory as SearchRecord,
} from '../db/schema.js';
import { eq, desc, and, asc, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { limitConcurrentSearches } from '../middleware/userRateLimit.js';
import {
    startScrapingTask,
    getTaskStatus,
    getTaskResults,
    isApifyConfigured,
    abortTask,
    type StartedTask,
} from '../services/apify.js';
import { creditRulesService } from '../services/creditRules.js';
import { autoTopUpService } from '../services/autoTopUp.js';
import { billingAlertService } from '../services/billingAlerts.js';
import { scraperRegistry } from '../services/scrapers/registry.js';
import { toStringArray } from '../services/scrapers/helpers.js';
import type { NormalizedContact, ScraperTemplate, ScraperRuntimeParams } from '../services/scrapers/types.js';

dotenv.config();

const router = Router();

type SearchStatusValue = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
type SearchResultsSortBy = 'business' | 'contact' | 'location';

type ErrorDetails = {
    type?: string;
    message?: string;
    stack?: string;
    apifyError?: any;
    statusCode?: number;
    timestamp?: string;
};

type SearchStatusPayload = {
    status: SearchStatusValue;
    requestedMaxResults?: number;
    requestEnrichment?: boolean;
    progress?: number;
    itemsCount?: number;
    totalResults?: number | null;
    savedResults?: number | null;
    standardResults?: number | null;
    enrichedResults?: number | null;
    creditsUsed?: number;
    completedAt?: Date | null;
    apifyRunId?: string | null;
    apifyActorId?: string | null;
    apifyActorName?: string | null;
    apifyDatasetId?: string | null;
    apifyStatusMessage?: string | null;
    apifyUsageUsd?: string | null;
    apifyContainerUrl?: string | null;
    apifyStartedAt?: Date | null;
    apifyFinishedAt?: Date | null;
    message?: string;
    duplicatesSkipped?: number;
    isAdmin?: boolean;
    errorDetails?: ErrorDetails;  // Only included for admins
};

// Validation is intentionally permissive here; per-template rules (which scraper,
// min/max results, required inputs) are enforced after resolving the template, since
// the limits live in the scraper registry (code defaults + DB overrides).
const startSearchSchema = z.object({
    // New template-based selector. Optional for back-compat with clients that still
    // send `requestEnrichment` instead.
    scrapeType: z.string().min(1).max(64).optional(),
    query: z.string().max(500).optional(),
    location: z.string().max(500).optional(),
    maxResults: z.number().int().min(1).max(1000).optional().default(50),
    requestEnrichment: z.boolean().optional().default(false),
    // Structured filters for non-Maps scrapers (e.g. B2B leads).
    filters: z.record(z.string(), z.unknown()).optional(),
});

function hasValidEmail(email?: string): boolean {
    if (!email) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isTerminalStatus(status: string): status is 'completed' | 'failed' | 'paused' {
    return status === 'completed' || status === 'failed' || status === 'paused';
}

function isEnrichmentSearch(searchRecord: SearchRecord): boolean {
    return searchRecord.requestEnrichment;
}

/**
 * Drains a charge across the credit buckets (monthly → rollover → purchased),
 * flooring every bucket at zero. Returns the new bucket values and the amount
 * that was *actually* drained — which is min(charge, total balance), so a debit
 * can never push a balance negative nor record a charge larger than what existed.
 * Must be called with the user row locked (SELECT ... FOR UPDATE) by the caller.
 */
function applyCreditWaterfall(
    balance: { credits: number; rolloverCredits: number; purchasedCredits: number },
    charge: number,
): { newMonthly: number; newRollover: number; newPurchased: number; actuallyCharged: number } {
    let remaining = Math.max(0, charge);

    const fromMonthly = Math.min(balance.credits, remaining);
    remaining -= fromMonthly;
    const fromRollover = Math.min(balance.rolloverCredits, remaining);
    remaining -= fromRollover;
    const fromPurchased = Math.min(balance.purchasedCredits, remaining);
    remaining -= fromPurchased;

    return {
        newMonthly: balance.credits - fromMonthly,
        newRollover: balance.rolloverCredits - fromRollover,
        newPurchased: balance.purchasedCredits - fromPurchased,
        actuallyCharged: fromMonthly + fromRollover + fromPurchased,
    };
}

/**
 * Map a normalized contact (from any scraper template) onto a contacts table row.
 * Social media and B2B fields are already populated by the template's mapResult,
 * so this is a flat projection — no re-extraction.
 */
function buildContactRow(
    place: NormalizedContact,
    searchId: string,
    userId: string,
    enrichmentCreditsCharged: number,
) {
    return {
        searchId,
        userId,
        contactType: place.contactType,
        title: place.title,
        category: place.category,
        address: place.address,
        phone: place.phone,
        website: place.website,
        email: place.email,
        rating: place.rating?.toString(),
        reviewCount: place.reviewCount,
        latitude: place.latitude?.toString(),
        longitude: place.longitude?.toString(),
        openingHours: place.openingHours,
        imageUrl: place.imageUrl,
        googleMapsUrl: place.googleMapsUrl,
        placeId: place.placeId,
        rawData: place.rawData,
        isEnriched: !!place.email,
        enrichmentCreditsCharged,
        // Social media
        facebook: place.facebook,
        instagram: place.instagram,
        twitter: place.twitter,
        linkedin: place.linkedin,
        youtube: place.youtube,
        tiktok: place.tiktok,
        pinterest: place.pinterest,
        // B2B lead fields
        firstName: place.firstName,
        lastName: place.lastName,
        jobTitle: place.jobTitle,
        seniority: place.seniority,
        personalEmail: place.personalEmail,
        companyName: place.companyName,
        companyDomain: place.companyDomain,
        companyLinkedin: place.companyLinkedin,
        companySize: place.companySize,
        industry: place.industry,
        companyRevenue: place.companyRevenue,
        companyFunding: place.companyFunding,
        dedupeKey: place.dedupeKey,
    };
}

/**
 * Derive the (notNull) query/location display labels for a search record. For
 * Google Maps these are the user's inputs; for structured-filter scrapers (B2B)
 * we synthesize a readable label from the filters so history still reads sensibly.
 */
function deriveSearchLabels(
    template: ScraperTemplate,
    query: string | undefined,
    location: string | undefined,
    filters: Record<string, unknown> | undefined,
): { query: string; location: string } {
    if (template.source === 'google_maps') {
        return { query: (query ?? '').trim(), location: (location ?? '').trim() };
    }
    const titles = toStringArray(filters?.jobTitles);
    const industries = toStringArray(filters?.industries);
    const locs = toStringArray(filters?.locations) ?? toStringArray(filters?.cities);
    return {
        query: titles?.join(', ') || industries?.join(', ') || template.label,
        location: locs?.join(', ') || 'Global',
    };
}

function buildErrorDetails(error: any): ErrorDetails {
    const errorDetails: ErrorDetails = {
        type: error?.constructor?.name || 'Error',
        message: error?.message || 'Unknown error',
        stack: error?.stack,
        statusCode: error?.statusCode || error?.response?.status,
        timestamp: new Date().toISOString(),
    };

    if (error?.apifyError || error?.response) {
        errorDetails.apifyError = {
            status: error?.response?.status,
            statusText: error?.response?.statusText,
            data: error?.response?.data,
        };
    }

    return errorDetails;
}

async function saveSearchError(searchId: string, error: any, customMessage?: string): Promise<void> {
    const errorDetails = buildErrorDetails(error);
    const failedAt = new Date();

    try {
        await db.update(searchHistory)
            .set({
                status: 'failed',
                apifyStatusMessage: customMessage || error?.message || 'Search failed',
                errorMessage: customMessage || error?.message || 'Search failed',
                errorCode: error?.code || error?.name || null,
                errorDetails,
                failedAt,
                apifyInput: sql`COALESCE(${searchHistory.apifyInput}, '{}'::jsonb) || ${JSON.stringify({ errorDetails })}::jsonb`,
                completedAt: failedAt,
            })
            .where(eq(searchHistory.id, searchId));

        console.error(`❌ Search ${searchId} failed:`, errorDetails);
    } catch (updateError) {
        console.error(`Failed to save error for search ${searchId}:`, updateError);
    }
}

function buildSearchPayload(searchRecord: SearchRecord, isAdmin: boolean = false): SearchStatusPayload {
    const payload: SearchStatusPayload = {
        status: searchRecord.status as SearchStatusValue,
        requestedMaxResults: searchRecord.requestedMaxResults,
        requestEnrichment: searchRecord.requestEnrichment,
        totalResults: searchRecord.totalResults,
        savedResults: searchRecord.savedResults,
        standardResults: searchRecord.standardResultsCount,
        enrichedResults: searchRecord.enrichedResultsCount,
        creditsUsed: searchRecord.creditsUsed,
        completedAt: searchRecord.completedAt,
        apifyRunId: searchRecord.apifyRunId,
        apifyActorId: searchRecord.apifyActorId,
        apifyActorName: searchRecord.apifyActorName,
        apifyDatasetId: searchRecord.apifyDatasetId,
        apifyStatusMessage: searchRecord.apifyStatusMessage,
        apifyUsageUsd: searchRecord.apifyUsageUsd,
        apifyContainerUrl: searchRecord.apifyContainerUrl,
        apifyStartedAt: searchRecord.apifyStartedAt,
        apifyFinishedAt: searchRecord.apifyFinishedAt,
    };

    // Include error details only for admins
    if (isAdmin && searchRecord.apifyInput) {
        const apifyInput = searchRecord.apifyInput as { errorDetails?: unknown } | null;
        if (apifyInput?.errorDetails) {
            payload.errorDetails = apifyInput.errorDetails;
        }
    }

    return payload;
}

function buildApifyTrackingUpdate(task: Pick<StartedTask, 'datasetId' | 'containerUrl' | 'startedAt' | 'usageTotalUsd' | 'statusMessage'>): Record<string, unknown> {
    return {
        ...(task.datasetId ? { apifyDatasetId: task.datasetId } : {}),
        ...(task.containerUrl ? { apifyContainerUrl: task.containerUrl } : {}),
        ...(task.startedAt ? { apifyStartedAt: task.startedAt } : {}),
        ...(task.usageTotalUsd !== undefined ? { apifyUsageUsd: task.usageTotalUsd.toFixed(4) } : {}),
        ...(task.statusMessage ? { apifyStatusMessage: task.statusMessage } : {}),
    };
}

async function getOwnedSearch(searchId: string, userId: string): Promise<SearchRecord | null> {
    const [searchRecord] = await db.select()
        .from(searchHistory)
        .where(and(
            eq(searchHistory.id, searchId),
            eq(searchHistory.userId, userId),
        ))
        .limit(1);

    return searchRecord ?? null;
}

async function checkCreditsAndTopUp(
    userId: string,
    estimatedCredits: number,
): Promise<{ sufficient: boolean; balance: number; topUpTriggered: boolean }> {
    const balance = await creditRulesService.getUserCreditBalance(userId);

    if (balance.total >= estimatedCredits) {
        return { sufficient: true, balance: balance.total, topUpTriggered: false };
    }

    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user || !user.autoTopUpEnabled) {
        return { sufficient: false, balance: balance.total, topUpTriggered: false };
    }

    if (user.subscriptionPlanId) {
        const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
            .limit(1);

        if (!plan || !plan.allowAutoTopUp) {
            return { sufficient: false, balance: balance.total, topUpTriggered: false };
        }
    }

    const topUpResult = await autoTopUpService.checkAndTrigger(userId);

    if (topUpResult.success && topUpResult.creditsAdded) {
        await billingAlertService.sendTopUpSuccessAlert(
            userId,
            topUpResult.creditsAdded,
            topUpResult.amountCharged || 0,
        );

        const newBalance = await creditRulesService.getUserCreditBalance(userId);
        return {
            sufficient: newBalance.total >= estimatedCredits,
            balance: newBalance.total,
            topUpTriggered: true,
        };
    }

    return { sufficient: false, balance: balance.total, topUpTriggered: false };
}

async function finalizeCompletedSearch(searchRecord: SearchRecord, userId: string): Promise<SearchStatusPayload> {
    const currentSearchRecord = await getOwnedSearch(searchRecord.id, userId);

    if (!currentSearchRecord) {
        throw new Error('Search not found');
    }

    if (isTerminalStatus(currentSearchRecord.status)) {
        const [user] = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        const isAdmin = user?.role === 'admin';
        return buildSearchPayload(currentSearchRecord, isAdmin);
    }

    const { template, runtime } = await scraperRegistry.resolve(currentSearchRecord.scrapeType);
    const isEnrichment = template.extractsEmails;
    const results = await getTaskResults(
        currentSearchRecord.apifyRunId!,
        currentSearchRecord.scrapeType,
        currentSearchRecord.requestedMaxResults,
    );
    const eligibleResults = results.slice(0, currentSearchRecord.requestedMaxResults);

    const [user] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new Error('User not found');
    }

    const isAdmin = user.role === 'admin';
    const creditResult = isAdmin
        ? {
            creditsCharged: 0,
            breakdown: { base: 0, enrichment: 0 },
            standardResults: isEnrichment ? 0 : eligibleResults.length,
            enrichedResults: isEnrichment ? eligibleResults.length : 0,
            duplicatesSkipped: 0,
            acceptedResults: eligibleResults,
        }
        : await creditRulesService.consumeCredits(
            userId,
            eligibleResults,
            currentSearchRecord.id,
            { creditsPerResult: runtime.creditsPerResult, isEnrichment },
        );

    const resultsToSave = isAdmin ? eligibleResults : creditResult.acceptedResults;

    const completedAt = new Date();

    // All state mutations happen inside ONE transaction. We claim the search row
    // with SELECT ... FOR UPDATE and re-check its status inside the lock so two
    // concurrent finalizers (the client polls /status and /history at the same
    // time) cannot both debit credits and insert duplicate contacts for the same
    // search. The Apify fetch and credit estimation above are read-only/idempotent
    // and were intentionally done outside the lock to avoid holding it across IO.
    const finalized = await db.transaction(async (tx) => {
        const [lockedSearch] = await tx.select()
            .from(searchHistory)
            .where(eq(searchHistory.id, currentSearchRecord.id))
            .for('update')
            .limit(1);

        if (!lockedSearch) {
            throw new Error('Search not found');
        }

        // A concurrent request already finalized this search — return its state
        // without charging again.
        if (isTerminalStatus(lockedSearch.status)) {
            return {
                alreadyFinalizedRecord: lockedSearch as SearchRecord,
                recordedCharge: lockedSearch.creditsUsed,
                savedResults: lockedSearch.savedResults ?? 0,
            };
        }

        let recordedCharge = 0;

        if (!isAdmin && creditResult.creditsCharged > 0) {
            const [freshUser] = await tx.select()
                .from(users)
                .where(eq(users.id, userId))
                .for('update')
                .limit(1);

            if (!freshUser) {
                throw new Error('User not found during credit debit');
            }

            const { newMonthly, newRollover, newPurchased, actuallyCharged } =
                applyCreditWaterfall(freshUser, creditResult.creditsCharged);
            recordedCharge = actuallyCharged;

            await tx.update(users)
                .set({
                    credits: newMonthly,
                    rolloverCredits: newRollover,
                    purchasedCredits: newPurchased,
                    monthlyCreditsUsed: freshUser.monthlyCreditsUsed + actuallyCharged,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, userId));

            await tx.insert(creditTransactions).values({
                userId,
                amount: -actuallyCharged,
                type: 'usage',
                description: `Search results: ${creditResult.standardResults} standard, ${creditResult.enrichedResults} enriched`,
                searchId: currentSearchRecord.id,
                metadata: {
                    standardResults: creditResult.standardResults,
                    enrichedResults: creditResult.enrichedResults,
                    breakdown: creditResult.breakdown,
                },
            });

            await tx.insert(billingEvents).values({
                userId,
                eventType: 'consumption',
                creditDelta: -actuallyCharged,
                searchId: currentSearchRecord.id,
                metadata: {
                    standardResults: creditResult.standardResults,
                    enrichedResults: creditResult.enrichedResults,
                },
            });
        }

        const savedResults = resultsToSave.length;

        if (savedResults > 0) {
            const contactsToInsert = resultsToSave.map((place) =>
                buildContactRow(
                    place,
                    currentSearchRecord.id,
                    userId,
                    isAdmin ? 0 : (isEnrichment && place.email ? runtime.creditsPerResult : 0),
                ),
            );

            await tx.insert(contacts).values(contactsToInsert);
        }

        await tx.update(searchHistory)
            .set({
                status: 'completed',
                totalResults: eligibleResults.length,
                savedResults,
                standardResultsCount: creditResult.standardResults,
                enrichedResultsCount: creditResult.enrichedResults,
                creditsUsed: isAdmin ? 0 : recordedCharge,
                completedAt,
                apifyFinishedAt: currentSearchRecord.apifyFinishedAt ?? completedAt,
            })
            .where(eq(searchHistory.id, currentSearchRecord.id));

        return { alreadyFinalizedRecord: null as SearchRecord | null, recordedCharge, savedResults };
    });

    if (finalized.alreadyFinalizedRecord) {
        return buildSearchPayload(finalized.alreadyFinalizedRecord, isAdmin);
    }

    // Non-critical, post-commit side effect.
    if (!isAdmin && finalized.recordedCharge > 0) {
        await billingAlertService.checkCreditAlerts(userId);
    }

    return {
        ...buildSearchPayload({
            ...currentSearchRecord,
            status: 'completed',
            totalResults: eligibleResults.length,
            savedResults: finalized.savedResults,
            standardResultsCount: creditResult.standardResults,
            enrichedResultsCount: creditResult.enrichedResults,
            creditsUsed: isAdmin ? 0 : finalized.recordedCharge,
            completedAt,
            apifyFinishedAt: currentSearchRecord.apifyFinishedAt ?? completedAt,
        }),
        duplicatesSkipped: creditResult.duplicatesSkipped,
        isAdmin,
    };
}

export async function syncSearchRecordState(searchRecord: SearchRecord, userId: string, isAdmin: boolean = false): Promise<SearchStatusPayload> {
    if (isTerminalStatus(searchRecord.status) || !searchRecord.apifyRunId) {
        return buildSearchPayload(searchRecord, isAdmin);
    }

    try {
        const apifyStatus = await getTaskStatus(searchRecord.apifyRunId);

        const trackingUpdate = {
            ...buildApifyTrackingUpdate({
                datasetId: apifyStatus.datasetId,
                containerUrl: apifyStatus.containerUrl,
                startedAt: apifyStatus.startedAt,
                usageTotalUsd: apifyStatus.usageTotalUsd,
                statusMessage: apifyStatus.statusMessage,
            }),
            ...(apifyStatus.finishedAt ? { apifyFinishedAt: apifyStatus.finishedAt } : {}),
        };

        if (apifyStatus.status === 'SUCCEEDED') {
            if (Object.keys(trackingUpdate).length > 0) {
                await db.update(searchHistory)
                    .set(trackingUpdate)
                    .where(eq(searchHistory.id, searchRecord.id));
            }
            return await finalizeCompletedSearch(searchRecord, userId);
        }

        if (apifyStatus.status === 'FAILED') {
            const completedAt = new Date();

            // Save error details for admin debugging
            const errorDetails: ErrorDetails = {
                type: 'ApifyTaskFailed',
                message: apifyStatus.statusMessage || 'Apify task failed',
                apifyError: {
                    status: apifyStatus.status,
                    statusMessage: apifyStatus.statusMessage,
                    datasetId: apifyStatus.datasetId,
                    exitCode: apifyStatus.exitCode,
                },
                timestamp: completedAt.toISOString(),
            };

            await db.update(searchHistory)
                .set({
                    status: 'failed',
                    errorMessage: apifyStatus.statusMessage || 'Apify task failed',
                    errorCode: apifyStatus.exitCode ? String(apifyStatus.exitCode) : 'APIFY_TASK_FAILED',
                    errorDetails,
                    failedAt: completedAt,
                    completedAt,
                    apifyInput: sql`COALESCE(${searchHistory.apifyInput}, '{}'::jsonb) || ${JSON.stringify({ errorDetails })}::jsonb`,
                    ...trackingUpdate,
                })
                .where(eq(searchHistory.id, searchRecord.id));

            return {
                ...buildSearchPayload({
                    ...searchRecord,
                    status: 'failed',
                    completedAt,
                    apifyDatasetId: apifyStatus.datasetId ?? searchRecord.apifyDatasetId,
                    apifyStatusMessage: apifyStatus.statusMessage ?? searchRecord.apifyStatusMessage,
                    apifyUsageUsd: apifyStatus.usageTotalUsd !== undefined
                        ? apifyStatus.usageTotalUsd.toFixed(4)
                        : searchRecord.apifyUsageUsd,
                    apifyContainerUrl: apifyStatus.containerUrl ?? searchRecord.apifyContainerUrl,
                    apifyStartedAt: apifyStatus.startedAt ?? searchRecord.apifyStartedAt,
                    apifyFinishedAt: apifyStatus.finishedAt ?? completedAt,
                }, isAdmin),
                message: 'Scraping task failed',
            };
        }

        if (apifyStatus.status === 'ABORTING' || apifyStatus.status === 'ABORTED') {
            const completedAt = new Date();

            await db.update(searchHistory)
                .set({
                    status: 'paused',
                    completedAt,
                    ...trackingUpdate,
                })
                .where(eq(searchHistory.id, searchRecord.id));

            return {
                ...buildSearchPayload({
                    ...searchRecord,
                    status: 'paused',
                    completedAt,
                    apifyDatasetId: apifyStatus.datasetId ?? searchRecord.apifyDatasetId,
                    apifyStatusMessage: apifyStatus.statusMessage ?? searchRecord.apifyStatusMessage,
                    apifyUsageUsd: apifyStatus.usageTotalUsd !== undefined
                        ? apifyStatus.usageTotalUsd.toFixed(4)
                        : searchRecord.apifyUsageUsd,
                    apifyContainerUrl: apifyStatus.containerUrl ?? searchRecord.apifyContainerUrl,
                    apifyStartedAt: apifyStatus.startedAt ?? searchRecord.apifyStartedAt,
                    apifyFinishedAt: apifyStatus.finishedAt ?? completedAt,
                }, isAdmin),
                message: 'Scraping task paused',
            };
        }

        const nextStatus: SearchStatusValue = apifyStatus.status === 'READY' ? 'pending' : 'running';

        if (searchRecord.status !== nextStatus || Object.keys(trackingUpdate).length > 0) {
            await db.update(searchHistory)
                .set({
                    status: nextStatus,
                    ...trackingUpdate,
                })
                .where(eq(searchHistory.id, searchRecord.id));
        }

        return {
            ...buildSearchPayload({
                ...searchRecord,
                status: nextStatus,
                apifyDatasetId: apifyStatus.datasetId ?? searchRecord.apifyDatasetId,
                apifyStatusMessage: apifyStatus.statusMessage ?? searchRecord.apifyStatusMessage,
                apifyUsageUsd: apifyStatus.usageTotalUsd !== undefined
                    ? apifyStatus.usageTotalUsd.toFixed(4)
                    : searchRecord.apifyUsageUsd,
                apifyContainerUrl: apifyStatus.containerUrl ?? searchRecord.apifyContainerUrl,
                apifyStartedAt: apifyStatus.startedAt ?? searchRecord.apifyStartedAt,
                apifyFinishedAt: apifyStatus.finishedAt ?? searchRecord.apifyFinishedAt,
            }, isAdmin),
            status: nextStatus,
            progress: apifyStatus.progress,
            itemsCount: apifyStatus.itemsCount,
        };
    } catch (error) {
        console.error(`Error syncing Apify status for search ${searchRecord.id}:`, error);
        return buildSearchPayload(searchRecord, isAdmin);
    }
}

router.post('/', requireAuth, limitConcurrentSearches, async (req, res: Response): Promise<void> => {
    let createdSearchId: string | null = null;
    let searchErrorSaved = false;

    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const userId = req.user.id;
        const validationResult = startSearchSchema.safeParse(req.body);

        if (!validationResult.success) {
            const flattened = validationResult.error.flatten();
            const message =
                flattened.formErrors[0]
                || flattened.fieldErrors.maxResults?.[0]
                || flattened.fieldErrors.query?.[0]
                || flattened.fieldErrors.location?.[0]
                || 'Validation failed';

            res.status(400).json({
                error: 'Validation failed',
                message,
                details: flattened,
            });
            return;
        }

        const {
            scrapeType: requestedScrapeType,
            query,
            location,
            maxResults: requestedMaxResults,
            requestEnrichment,
            filters,
        } = validationResult.data;

        if (!isApifyConfigured()) {
            res.status(503).json({
                error: 'Scraping service is not configured. Please contact administrator.',
            });
            return;
        }

        // Resolve the scraper template. Back-compat: clients that still send
        // `requestEnrichment` map onto the standard/enriched Google Maps templates.
        const scrapeType = requestedScrapeType ?? (requestEnrichment ? 'enriched' : 'standard');
        const template = scraperRegistry.getTemplate(scrapeType);

        if (!template) {
            res.status(400).json({ error: 'Invalid scraper', message: `Unknown scraper type "${scrapeType}".` });
            return;
        }

        const { runtime } = await scraperRegistry.resolve(scrapeType);

        if (!runtime.isActive) {
            res.status(400).json({ error: 'Scraper unavailable', message: `${template.label} is currently disabled.` });
            return;
        }

        // Per-source input validation.
        if (template.source === 'google_maps') {
            if (!query || query.trim().length < 2 || !location || location.trim().length < 2) {
                res.status(400).json({
                    error: 'Validation failed',
                    message: 'Query and location are required (at least 2 characters each).',
                });
                return;
            }
        } else {
            const hasAnyFilter = !!filters && Object.values(filters).some((v) =>
                Array.isArray(v) ? v.length > 0 : (typeof v === 'string' ? v.trim().length > 0 : v != null));
            if (!hasAnyFilter) {
                res.status(400).json({ error: 'Validation failed', message: 'At least one search filter is required.' });
                return;
            }
        }

        // Validate/clamp the requested volume against the template's limits.
        if (requestedMaxResults < runtime.minResults) {
            res.status(400).json({
                error: 'Validation failed',
                message: `${template.label} requires at least ${runtime.minResults} results.`,
            });
            return;
        }
        const maxResults = Math.min(requestedMaxResults, runtime.maxResults);

        const [user] = await db.select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (user.accountRiskFlag === 'suspended' || user.accountRiskFlag === 'restricted') {
            res.status(403).json({ error: 'Account is restricted' });
            return;
        }

        const creditsPerLead = runtime.creditsPerResult;
        const estimatedCredits = maxResults * creditsPerLead;
        const isAdmin = user.role === 'admin';

        let creditCheck = { sufficient: true, balance: 0, topUpTriggered: false };

        if (!isAdmin) {
            creditCheck = await checkCreditsAndTopUp(userId, estimatedCredits);

            if (!creditCheck.sufficient) {
                res.status(402).json({
                    error: 'Insufficient credits',
                    required: estimatedCredits,
                    available: creditCheck.balance,
                    topUpTriggered: creditCheck.topUpTriggered,
                });
                return;
            }
        }

        const labels = deriveSearchLabels(template, query, location, filters);

        const [searchRecord] = await db.insert(searchHistory).values({
            userId,
            query: labels.query,
            location: labels.location,
            requestedMaxResults: maxResults,
            requestEnrichment: template.extractsEmails,
            scrapeType: template.key,
            searchFilters: template.source === 'google_maps' ? null : (filters ?? {}),
            status: 'pending',
            creditsUsed: 0,
            standardResultsCount: template.extractsEmails ? null : 0,
            enrichedResultsCount: template.extractsEmails ? 0 : null,
        }).returning();
        createdSearchId = searchRecord.id;

        let startedTask!: StartedTask;

        try {
            startedTask = await startScrapingTask(template.key, {
                maxResults,
                language: '',
                countryCode: '',
                query,
                location,
                filters,
            });

            await db.update(searchHistory)
                .set({
                    apifyRunId: startedTask.runId,
                    apifyActorId: startedTask.actorId,
                    apifyActorName: startedTask.actorName,
                    apifyInput: startedTask.input,
                    status: 'running',
                    errorMessage: null,
                    errorCode: null,
                    errorDetails: null,
                    failedAt: null,
                    ...buildApifyTrackingUpdate(startedTask),
                })
                .where(eq(searchHistory.id, searchRecord.id));
        } catch (apifyError) {
            await saveSearchError(searchRecord.id, apifyError, 'Failed to start search');
            searchErrorSaved = true;
            throw apifyError;
        }

        res.status(202).json({
            message: 'Search started successfully',
            searchId: searchRecord.id,
            apifyRunId: startedTask.runId,
            scrapeType: template.key,
            estimatedCredits: isAdmin ? 0 : estimatedCredits,
            creditsPerLead,
            requestEnrichment: template.extractsEmails,
            topUpTriggered: creditCheck.topUpTriggered,
            isAdmin,
        });
    } catch (error) {
        console.error('Search error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (createdSearchId && !searchErrorSaved) {
            await saveSearchError(createdSearchId, error, 'Failed to start search');
        }

        res.status(500).json({
            error: 'Failed to start search',
            message: errorMessage,
        });
    }
});

// List the active scrapers and their input schemas — drives the dynamic search form.
router.get('/scrapers', requireAuth, async (_req, res: Response): Promise<void> => {
    try {
        const active = await scraperRegistry.listActive();
        res.json({
            scrapers: active.map(({ template, runtime }) => ({
                key: template.key,
                source: template.source,
                label: template.label,
                description: template.description,
                extractsEmails: template.extractsEmails,
                billing: template.billing,
                inputSchema: template.inputSchema,
                creditsPerResult: runtime.creditsPerResult,
                minResults: runtime.minResults,
                maxResults: runtime.maxResults,
            })),
        });
    } catch (error) {
        console.error('List scrapers error:', error);
        res.status(500).json({ error: 'Failed to list scrapers' });
    }
});

router.get('/:searchId/status', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const searchRecord = await getOwnedSearch((req.params.searchId as string), req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        const isAdmin = req.user.role === 'admin';
        const payload = await syncSearchRecordState(searchRecord, req.user.id, isAdmin);
        res.json(payload);
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/:searchId/pause', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const searchRecord = await getOwnedSearch((req.params.searchId as string), req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        if (isTerminalStatus(searchRecord.status)) {
            res.status(409).json({ error: `Search is already ${searchRecord.status}` });
            return;
        }

        if (!searchRecord.apifyRunId) {
            res.status(409).json({ error: 'Search has not been linked to an Apify run yet' });
            return;
        }

        const userId = req.user.id;

        // Abort the Apify task
        await abortTask(searchRecord.apifyRunId);

        // Collect any partial results gathered before the abort, then persist
        // everything — credit debit, contacts, and the paused status — inside ONE
        // transaction that claims the search row. This guarantees a charge can't
        // commit without its contacts (no charge-without-delivery) and a concurrent
        // finalize can't be silently double-charged.
        let partialLeadsSaved = 0;
        let creditsCharged = 0;
        const completedAt = new Date();

        try {
            const { template, runtime } = await scraperRegistry.resolve(searchRecord.scrapeType);
            const isEnrichment = template.extractsEmails;
            const partialResults = await getTaskResults(
                searchRecord.apifyRunId,
                searchRecord.scrapeType,
                searchRecord.requestedMaxResults,
            );
            const eligibleResults = partialResults.slice(0, searchRecord.requestedMaxResults);

            const [user] = await db.select()
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);

            if (!user) {
                throw new Error(`User ${userId} not found while finalizing paused search`);
            }

            const isAdmin = user.role === 'admin';

            // Estimate the charge / accepted results outside the lock (reads only).
            const creditResult = (!isAdmin && eligibleResults.length > 0)
                ? await creditRulesService.consumeCredits(
                    userId,
                    eligibleResults,
                    searchRecord.id,
                    { creditsPerResult: runtime.creditsPerResult, isEnrichment },
                )
                : null;
            const resultsToSave = isAdmin ? eligibleResults : (creditResult?.acceptedResults ?? []);

            await db.transaction(async (tx) => {
                const [lockedSearch] = await tx.select()
                    .from(searchHistory)
                    .where(eq(searchHistory.id, searchRecord.id))
                    .for('update')
                    .limit(1);

                if (!lockedSearch) {
                    throw new Error('Search not found');
                }

                // A concurrent finalize already terminalized this search — respect it.
                if (isTerminalStatus(lockedSearch.status)) {
                    partialLeadsSaved = lockedSearch.savedResults ?? 0;
                    creditsCharged = lockedSearch.creditsUsed;
                    return;
                }

                if (creditResult && creditResult.creditsCharged > 0) {
                    const [freshUser] = await tx.select()
                        .from(users)
                        .where(eq(users.id, userId))
                        .for('update')
                        .limit(1);

                    if (!freshUser) {
                        throw new Error(`User ${userId} not found during paused credit debit`);
                    }

                    const { newMonthly, newRollover, newPurchased, actuallyCharged } =
                        applyCreditWaterfall(freshUser, creditResult.creditsCharged);
                    creditsCharged = actuallyCharged;

                    await tx.update(users)
                        .set({
                            credits: newMonthly,
                            rolloverCredits: newRollover,
                            purchasedCredits: newPurchased,
                            monthlyCreditsUsed: freshUser.monthlyCreditsUsed + actuallyCharged,
                            updatedAt: new Date(),
                        })
                        .where(eq(users.id, userId));

                    await tx.insert(creditTransactions).values({
                        userId,
                        amount: -actuallyCharged,
                        type: 'usage',
                        description: `Partial results (paused): ${creditResult.standardResults} standard, ${creditResult.enrichedResults} enriched`,
                        searchId: searchRecord.id,
                        metadata: {
                            standardResults: creditResult.standardResults,
                            enrichedResults: creditResult.enrichedResults,
                            breakdown: creditResult.breakdown,
                            paused: true,
                        },
                    });

                    await tx.insert(billingEvents).values({
                        userId,
                        eventType: 'consumption',
                        creditDelta: -actuallyCharged,
                        searchId: searchRecord.id,
                        metadata: {
                            standardResults: creditResult.standardResults,
                            enrichedResults: creditResult.enrichedResults,
                            paused: true,
                        },
                    });
                }

                if (resultsToSave.length > 0) {
                    const contactsToInsert = resultsToSave.map((place) =>
                        buildContactRow(
                            place,
                            searchRecord.id,
                            userId,
                            isAdmin ? 0 : (isEnrichment && place.email ? runtime.creditsPerResult : 0),
                        ),
                    );

                    await tx.insert(contacts).values(contactsToInsert);
                }

                partialLeadsSaved = resultsToSave.length;

                await tx.update(searchHistory)
                    .set({
                        status: 'paused',
                        completedAt,
                        apifyFinishedAt: completedAt,
                        totalResults: partialLeadsSaved,
                        savedResults: partialLeadsSaved,
                        creditsUsed: creditsCharged,
                    })
                    .where(eq(searchHistory.id, searchRecord.id));
            });

            if (!isAdmin && creditsCharged > 0) {
                await billingAlertService.checkCreditAlerts(userId);
            }

            console.log(`✅ Paused search ${searchRecord.id}: saved ${partialLeadsSaved} leads, charged ${creditsCharged} credits`);
        } catch (resultsError) {
            console.error('Error finalizing paused search:', resultsError);
            // Even if partial-result processing failed, still mark the search paused.
            await db.update(searchHistory)
                .set({
                    status: 'paused',
                    completedAt,
                    apifyFinishedAt: completedAt,
                    totalResults: partialLeadsSaved,
                    savedResults: partialLeadsSaved,
                    creditsUsed: creditsCharged,
                })
                .where(eq(searchHistory.id, searchRecord.id))
                .catch((updateError) => {
                    console.error('Failed to mark search paused after error:', updateError);
                });
        }

        res.json({
            message: 'Search paused successfully',
            status: 'paused',
            completedAt,
            partialLeadsSaved,
            creditsCharged,
        });
    } catch (error) {
        console.error('Pause search error:', error);
        res.status(500).json({
            error: 'Failed to pause search',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

router.get('/history', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const history = await db.select()
            .from(searchHistory)
            .where(eq(searchHistory.userId, req.user.id))
            .orderBy(desc(searchHistory.createdAt))
            .limit(limit)
            .offset(offset);

        const [countResult] = await db.select({
            count: sql<number>`count(*)::int`,
        })
            .from(searchHistory)
            .where(eq(searchHistory.userId, req.user.id));

        const isAdmin = req.user.role === 'admin';
        const syncedHistory: SearchRecord[] = [];

        for (const searchRecord of history) {
            if (searchRecord.status === 'running' || searchRecord.status === 'pending') {
                await syncSearchRecordState(searchRecord, req.user.id, isAdmin);
                const refreshedRecord = await getOwnedSearch(searchRecord.id, req.user.id);
                syncedHistory.push(refreshedRecord ?? searchRecord);
            } else {
                syncedHistory.push(searchRecord);
            }
        }

        const total = countResult?.count ?? 0;

        res.json({
            history: syncedHistory,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:searchId/results', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const searchRecord = await getOwnedSearch((req.params.searchId as string), req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const favoriteOnly = req.query.favorite === 'true';
        const showArchived = req.query.showArchived === 'true';
        const requestedSortBy = req.query.sortBy as SearchResultsSortBy | undefined;
        const sortBy: SearchResultsSortBy | undefined =
            requestedSortBy === 'business' || requestedSortBy === 'contact' || requestedSortBy === 'location'
                ? requestedSortBy
                : undefined;
        const sortDirection = req.query.sortDirection === 'desc' ? 'desc' : 'asc';
        const offset = (page - 1) * limit;

        const conditions = [eq(contacts.searchId, (req.params.searchId as string))];
        if (favoriteOnly) conditions.push(eq(contacts.isFavorite, true));
        if (!showArchived) conditions.push(eq(contacts.isArchived, false));
        const whereClause = and(...conditions);
        const sortExpressions = {
            business: sql<string>`lower(coalesce(${contacts.title}, ''))`,
            contact: sql<string>`lower(coalesce(${contacts.email}, ${contacts.phone}, ${contacts.website}, ''))`,
            location: sql<string>`lower(coalesce(${contacts.address}, ''))`,
        } satisfies Record<SearchResultsSortBy, ReturnType<typeof sql<string>>>;
        const orderClause = sortBy
            ? (sortDirection === 'desc' ? desc(sortExpressions[sortBy]) : asc(sortExpressions[sortBy]))
            : desc(contacts.createdAt);

        const results = await db.select()
            .from(contacts)
            .where(whereClause)
            .orderBy(orderClause, desc(contacts.createdAt))
            .limit(limit)
            .offset(offset);

        const [countResult] = await db.select({
            count: sql<number>`count(*)::int`,
        })
            .from(contacts)
            .where(whereClause);

        const total = countResult?.count ?? 0;

        // Count archived contacts for this search
        const [archivedCountResult] = await db.select({
            count: sql<number>`count(*)::int`,
        })
            .from(contacts)
            .where(and(eq(contacts.searchId, (req.params.searchId as string)), eq(contacts.isArchived, true)));

        res.json({
            results,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            archivedCount: archivedCountResult?.count ?? 0,
        });
    } catch (error) {
        console.error('Get search results error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:searchId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const searchRecord = await getOwnedSearch((req.params.searchId as string), req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        const searchContacts = await db.select()
            .from(contacts)
            .where(eq(contacts.searchId, (req.params.searchId as string)));

        res.json({
            search: searchRecord,
            contacts: searchContacts,
        });
    } catch (error) {
        console.error('Get search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:searchId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const searchRecord = await getOwnedSearch((req.params.searchId as string), req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        await db.delete(contacts)
            .where(eq(contacts.searchId, (req.params.searchId as string)));

        await db.delete(searchHistory)
            .where(eq(searchHistory.id, (req.params.searchId as string)));

        res.json({ message: 'Search deleted successfully' });
    } catch (error) {
        console.error('Delete search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin-only endpoint to get detailed error information for any search
router.get('/:searchId/error-details', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Only allow admins to access error details
        if (req.user.role !== 'admin') {
            res.status(403).json({ error: 'Forbidden: Admin access required' });
            return;
        }

        const [searchRecord] = await db.select()
            .from(searchHistory)
            .where(eq(searchHistory.id, (req.params.searchId as string)))
            .limit(1);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        // Extract error details from dedicated columns first, then legacy apifyInput storage
        const apifyInput = searchRecord.apifyInput as any;
        const errorDetails = searchRecord.errorDetails || apifyInput?.errorDetails || (
            searchRecord.errorMessage
                ? {
                    type: searchRecord.errorCode || 'SearchError',
                    message: searchRecord.errorMessage,
                    timestamp: searchRecord.failedAt ? searchRecord.failedAt.toISOString() : undefined,
                }
                : null
        );

        res.json({
            searchId: searchRecord.id,
            status: searchRecord.status,
            query: searchRecord.query,
            location: searchRecord.location,
            userId: searchRecord.userId,
            apifyRunId: searchRecord.apifyRunId,
            apifyStatusMessage: searchRecord.apifyStatusMessage,
            errorMessage: searchRecord.errorMessage,
            completedAt: searchRecord.completedAt,
            errorDetails,
            // Include full apify input for debugging
            apifyInput: searchRecord.apifyInput,
        });
    } catch (error) {
        console.error('Get error details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
