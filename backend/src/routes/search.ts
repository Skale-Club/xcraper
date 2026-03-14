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
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { limitConcurrentSearches, incrementUserSearchCount } from '../middleware/userRateLimit.js';
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

dotenv.config();

const router = Router();

type SearchStatusValue = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

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
};

const startSearchSchema = z.object({
    query: z.string().min(2, 'Search query must be at least 2 characters'),
    location: z.string().min(2, 'Location must be at least 2 characters'),
    maxResults: z.number().int().min(1).max(500).optional().default(50),
    requestEnrichment: z.boolean().optional().default(false),
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

function buildSearchPayload(searchRecord: SearchRecord): SearchStatusPayload {
    return {
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
        return buildSearchPayload(currentSearchRecord);
    }

    const results = await getTaskResults(currentSearchRecord.apifyRunId!);
    const requestEnrichment = isEnrichmentSearch(currentSearchRecord);
    const cappedResults = results.slice(0, currentSearchRecord.requestedMaxResults);
    const eligibleResults = requestEnrichment
        ? cappedResults.filter((result) => hasValidEmail(result.email))
        : cappedResults;

    const [user] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new Error('User not found');
    }

    const isAdmin = user.role === 'admin';
    const creditableResults = eligibleResults.map((result) => ({
        placeId: result.placeId,
        title: result.title,
        email: result.email,
        phone: result.phone,
        address: result.address,
        website: result.website,
        category: result.category,
        rating: result.rating,
        reviewCount: result.reviewCount,
        latitude: result.latitude,
        longitude: result.longitude,
    }));

    const creditResult = isAdmin
        ? {
            creditsCharged: 0,
            breakdown: { base: 0, enrichment: 0 },
            standardResults: requestEnrichment ? 0 : eligibleResults.length,
            enrichedResults: requestEnrichment ? eligibleResults.length : 0,
            duplicatesSkipped: 0,
        }
        : await creditRulesService.consumeCredits(
            userId,
            creditableResults,
            currentSearchRecord.id,
            requestEnrichment,
        );

    if (creditResult.creditsCharged > 0 && !isAdmin) {
        let remainingCredits = creditResult.creditsCharged;
        let newMonthly = user.credits;
        let newRollover = user.rolloverCredits;
        let newPurchased = user.purchasedCredits;

        if (newMonthly >= remainingCredits) {
            newMonthly -= remainingCredits;
            remainingCredits = 0;
        } else {
            remainingCredits -= newMonthly;
            newMonthly = 0;
        }

        if (remainingCredits > 0 && newRollover >= remainingCredits) {
            newRollover -= remainingCredits;
            remainingCredits = 0;
        } else if (remainingCredits > 0) {
            remainingCredits -= newRollover;
            newRollover = 0;
        }

        if (remainingCredits > 0) {
            newPurchased = Math.max(0, newPurchased - remainingCredits);
        }

        await db.update(users)
            .set({
                credits: newMonthly,
                rolloverCredits: newRollover,
                purchasedCredits: newPurchased,
                monthlyCreditsUsed: user.monthlyCreditsUsed + creditResult.creditsCharged,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        await db.insert(creditTransactions).values({
            userId,
            amount: -creditResult.creditsCharged,
            type: 'usage',
            description: `Search results: ${creditResult.standardResults} standard, ${creditResult.enrichedResults} enriched`,
            searchId: currentSearchRecord.id,
            metadata: {
                standardResults: creditResult.standardResults,
                enrichedResults: creditResult.enrichedResults,
                breakdown: creditResult.breakdown,
            },
        });

        await db.insert(billingEvents).values({
            userId,
            eventType: 'consumption',
            creditDelta: -creditResult.creditsCharged,
            searchId: currentSearchRecord.id,
            metadata: {
                standardResults: creditResult.standardResults,
                enrichedResults: creditResult.enrichedResults,
            },
        });

        await billingAlertService.checkCreditAlerts(userId);
    }

    const savedResults = creditResult.standardResults + creditResult.enrichedResults;

    if (savedResults > 0) {
        const contactsToInsert = eligibleResults
            .slice(0, savedResults)
            .map((place) => ({
                searchId: currentSearchRecord.id,
                userId,
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
                enrichmentCreditsCharged: isAdmin
                    ? 0
                    : place.email
                        ? creditResult.breakdown.enrichment
                        : 0,
            }));

        await db.insert(contacts).values(contactsToInsert);
    }

    const completedAt = new Date();

    await db.update(searchHistory)
        .set({
            status: 'completed',
            totalResults: eligibleResults.length,
            savedResults,
            standardResultsCount: creditResult.standardResults,
            enrichedResultsCount: creditResult.enrichedResults,
            creditsUsed: isAdmin ? 0 : creditResult.creditsCharged,
            completedAt,
            apifyFinishedAt: currentSearchRecord.apifyFinishedAt ?? completedAt,
        })
        .where(eq(searchHistory.id, currentSearchRecord.id));

    return {
        ...buildSearchPayload({
            ...currentSearchRecord,
            status: 'completed',
            totalResults: eligibleResults.length,
            savedResults,
            standardResultsCount: creditResult.standardResults,
            enrichedResultsCount: creditResult.enrichedResults,
            creditsUsed: isAdmin ? 0 : creditResult.creditsCharged,
            completedAt,
            apifyFinishedAt: currentSearchRecord.apifyFinishedAt ?? completedAt,
        }),
        duplicatesSkipped: creditResult.duplicatesSkipped,
        isAdmin,
    };
}

async function syncSearchRecordState(searchRecord: SearchRecord, userId: string): Promise<SearchStatusPayload> {
    if (isTerminalStatus(searchRecord.status) || !searchRecord.apifyRunId) {
        return buildSearchPayload(searchRecord);
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

            await db.update(searchHistory)
                .set({
                    status: 'failed',
                    completedAt,
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
                }),
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
                }),
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
            }),
            status: nextStatus,
            progress: apifyStatus.progress,
            itemsCount: apifyStatus.itemsCount,
        };
    } catch (error) {
        console.error(`Error syncing Apify status for search ${searchRecord.id}:`, error);
        return buildSearchPayload(searchRecord);
    }
}

router.post('/', requireAuth, limitConcurrentSearches, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const userId = req.user.id;
        const validationResult = startSearchSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten(),
            });
            return;
        }

        const { query, location, maxResults, requestEnrichment } = validationResult.data;

        if (!isApifyConfigured()) {
            res.status(503).json({
                error: 'Scraping service is not configured. Please contact administrator.',
            });
            return;
        }

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

        const rules = await creditRulesService.getPricingRules();
        const creditsPerLead = requestEnrichment
            ? rules.creditsPerEnrichedResult
            : rules.creditsPerStandardResult;
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

        const [searchRecord] = await db.insert(searchHistory).values({
            userId,
            query,
            location,
            requestedMaxResults: maxResults,
            requestEnrichment,
            status: 'pending',
            creditsUsed: 0,
            standardResultsCount: requestEnrichment ? null : 0,
            enrichedResultsCount: requestEnrichment ? 0 : null,
        }).returning();

        let startedTask!: StartedTask;

        try {
            startedTask = await startScrapingTask({
                search: query,
                location,
                maxResults,
                extractEmails: requestEnrichment,
            });

            await db.update(searchHistory)
                .set({
                    apifyRunId: startedTask.runId,
                    apifyActorId: startedTask.actorId,
                    apifyActorName: startedTask.actorName,
                    apifyInput: startedTask.input,
                    status: 'running',
                    ...buildApifyTrackingUpdate(startedTask),
                })
                .where(eq(searchHistory.id, searchRecord.id));

            // Increment concurrent search counter
            incrementUserSearchCount(userId);
        } catch (apifyError) {
            await db.update(searchHistory)
                .set({
                    status: 'failed',
                    completedAt: new Date(),
                })
                .where(eq(searchHistory.id, searchRecord.id));

            throw apifyError;
        }

        res.status(202).json({
            message: 'Search started successfully',
            searchId: searchRecord.id,
            apifyRunId: startedTask.runId,
            estimatedCredits: isAdmin ? 0 : estimatedCredits,
            creditsPerLead,
            requestEnrichment,
            topUpTriggered: creditCheck.topUpTriggered,
            isAdmin,
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Failed to start search',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

router.get('/:searchId/status', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const searchRecord = await getOwnedSearch(req.params.searchId, req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        const payload = await syncSearchRecordState(searchRecord, req.user.id);
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

        const searchRecord = await getOwnedSearch(req.params.searchId, req.user.id);

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

        // Try to get partial results that were collected before pause
        let partialLeadsSaved = 0;
        let creditsCharged = 0;

        try {
            const partialResults = await getTaskResults(searchRecord.apifyRunId);

            if (partialResults.length > 0) {
                console.log(`📊 Found ${partialResults.length} partial results for paused search ${searchRecord.id}`);

                // Get user to check if admin
                const [user] = await db.select()
                    .from(users)
                    .where(eq(users.id, userId))
                    .limit(1);

                const isAdmin = user?.role === 'admin';

                // Filter and process partial results
                const requestEnrichment = isEnrichmentSearch(searchRecord);
                const cappedResults = partialResults.slice(0, searchRecord.requestedMaxResults);
                const eligibleResults = requestEnrichment
                    ? cappedResults.filter((result) => hasValidEmail(result.email))
                    : cappedResults;

                if (eligibleResults.length > 0 && !isAdmin) {
                    // Calculate and charge credits for partial results
                    const creditableResults = eligibleResults.map((result) => ({
                        placeId: result.placeId,
                        title: result.title,
                        email: result.email,
                        phone: result.phone,
                        address: result.address,
                        website: result.website,
                        category: result.category,
                        rating: result.rating,
                        reviewCount: result.reviewCount,
                        latitude: result.latitude,
                        longitude: result.longitude,
                    }));

                    const creditResult = await creditRulesService.consumeCredits(
                        userId,
                        creditableResults,
                        searchRecord.id,
                        requestEnrichment,
                    );

                    // Debit credits from user balance
                    let remainingCredits = creditResult.creditsCharged;
                    let newMonthly = user!.credits;
                    let newRollover = user!.rolloverCredits;
                    let newPurchased = user!.purchasedCredits;

                    if (newMonthly >= remainingCredits) {
                        newMonthly -= remainingCredits;
                        remainingCredits = 0;
                    } else {
                        remainingCredits -= newMonthly;
                        newMonthly = 0;
                    }

                    if (remainingCredits > 0 && newRollover >= remainingCredits) {
                        newRollover -= remainingCredits;
                        remainingCredits = 0;
                    } else if (remainingCredits > 0) {
                        remainingCredits -= newRollover;
                        newRollover = 0;
                    }

                    if (remainingCredits > 0) {
                        newPurchased = Math.max(0, newPurchased - remainingCredits);
                    }

                    await db.update(users)
                        .set({
                            credits: newMonthly,
                            rolloverCredits: newRollover,
                            purchasedCredits: newPurchased,
                            monthlyCreditsUsed: user!.monthlyCreditsUsed + creditResult.creditsCharged,
                            updatedAt: new Date(),
                        })
                        .where(eq(users.id, userId));

                    // Save transaction
                    await db.insert(creditTransactions).values({
                        userId,
                        amount: -creditResult.creditsCharged,
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

                    await db.insert(billingEvents).values({
                        userId,
                        eventType: 'consumption',
                        creditDelta: -creditResult.creditsCharged,
                        searchId: searchRecord.id,
                        metadata: {
                            standardResults: creditResult.standardResults,
                            enrichedResults: creditResult.enrichedResults,
                            paused: true,
                        },
                    });

                    partialLeadsSaved = creditResult.standardResults + creditResult.enrichedResults;
                    creditsCharged = creditResult.creditsCharged;

                    // Save partial contacts
                    const contactsToInsert = eligibleResults
                        .slice(0, partialLeadsSaved)
                        .map((place) => ({
                            searchId: searchRecord.id,
                            userId,
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
                            enrichmentCreditsCharged: place.email ? creditResult.breakdown.enrichment : 0,
                        }));

                    if (contactsToInsert.length > 0) {
                        await db.insert(contacts).values(contactsToInsert);
                    }

                    console.log(`✅ Saved ${partialLeadsSaved} partial leads, charged ${creditsCharged} credits`);
                } else if (isAdmin && eligibleResults.length > 0) {
                    // Admin: Save contacts but don't charge
                    const contactsToInsert = eligibleResults.map((place) => ({
                        searchId: searchRecord.id,
                        userId,
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
                        enrichmentCreditsCharged: 0,
                    }));

                    await db.insert(contacts).values(contactsToInsert);
                    partialLeadsSaved = contactsToInsert.length;
                    console.log(`✅ Admin: Saved ${partialLeadsSaved} partial leads (no charge)`);
                }
            }
        } catch (resultsError) {
            console.error('Error fetching partial results:', resultsError);
            // Continue with pause even if can't get partial results
        }

        const completedAt = new Date();

        await db.update(searchHistory)
            .set({
                status: 'paused',
                completedAt,
                apifyFinishedAt: completedAt,
                totalResults: partialLeadsSaved,
                savedResults: partialLeadsSaved,
                creditsUsed: creditsCharged,
            })
            .where(eq(searchHistory.id, searchRecord.id));

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

        const syncedHistory: SearchRecord[] = [];

        for (const searchRecord of history) {
            if (searchRecord.status === 'running' || searchRecord.status === 'pending') {
                await syncSearchRecordState(searchRecord, req.user.id);
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

        const searchRecord = await getOwnedSearch(req.params.searchId, req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const results = await db.select()
            .from(contacts)
            .where(eq(contacts.searchId, req.params.searchId))
            .orderBy(desc(contacts.createdAt))
            .limit(limit)
            .offset(offset);

        const [countResult] = await db.select({
            count: sql<number>`count(*)::int`,
        })
            .from(contacts)
            .where(eq(contacts.searchId, req.params.searchId));

        const total = countResult?.count ?? 0;

        res.json({
            results,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit)),
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

        const searchRecord = await getOwnedSearch(req.params.searchId, req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        const searchContacts = await db.select()
            .from(contacts)
            .where(eq(contacts.searchId, req.params.searchId));

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

        const searchRecord = await getOwnedSearch(req.params.searchId, req.user.id);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        await db.delete(contacts)
            .where(eq(contacts.searchId, req.params.searchId));

        await db.delete(searchHistory)
            .where(eq(searchHistory.id, req.params.searchId));

        res.json({ message: 'Search deleted successfully' });
    } catch (error) {
        console.error('Delete search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
