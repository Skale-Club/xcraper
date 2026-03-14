import { Router, Response } from 'express';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import { db } from '../db/index.js';
import { users, searchHistory, contacts, creditTransactions, billingEvents, subscriptionPlans } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import {
    startScrapingTask,
    getTaskStatus,
    getTaskResults,
    isApifyConfigured
} from '../services/apify.js';
import { creditRulesService } from '../services/creditRules.js';
import { autoTopUpService } from '../services/autoTopUp.js';
import { billingAlertService } from '../services/billingAlerts.js';

dotenv.config();

const router = Router();

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

async function checkCreditsAndTopUp(
    userId: string, 
    estimatedCredits: number
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
            topUpResult.amountCharged || 0
        );
        
        const newBalance = await creditRulesService.getUserCreditBalance(userId);
        return { 
            sufficient: newBalance.total >= estimatedCredits, 
            balance: newBalance.total, 
            topUpTriggered: true 
        };
    }

    return { sufficient: false, balance: balance.total, topUpTriggered: false };
}

router.post('/', requireAuth, async (req, res: Response): Promise<void> => {
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
                details: validationResult.error.flatten()
            });
            return;
        }

        const { query, location, maxResults, requestEnrichment } = validationResult.data;

        if (!isApifyConfigured()) {
            res.status(503).json({
                error: 'Scraping service is not configured. Please contact administrator.'
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

        const creditCheck = await checkCreditsAndTopUp(userId, estimatedCredits);

        if (!creditCheck.sufficient) {
            res.status(402).json({
                error: 'Insufficient credits',
                required: estimatedCredits,
                available: creditCheck.balance,
                topUpTriggered: creditCheck.topUpTriggered,
            });
            return;
        }

        const [searchRecord] = await db.insert(searchHistory).values({
            userId,
            query,
            location,
            status: 'pending',
            creditsUsed: 0,
            standardResultsCount: requestEnrichment ? null : 0,
            enrichedResultsCount: requestEnrichment ? 0 : null,
        }).returning();

        let apifyRunId: string;
        try {
            apifyRunId = await startScrapingTask({
                search: query,
                location,
                maxResults,
                extractEmails: requestEnrichment,
            });

            await db.update(searchHistory)
                .set({
                    apifyRunId,
                    status: 'running'
                })
                .where(eq(searchHistory.id, searchRecord.id));

        } catch (apifyError) {
            await db.update(searchHistory)
                .set({ status: 'failed' })
                .where(eq(searchHistory.id, searchRecord.id));

            throw apifyError;
        }

        res.status(202).json({
            message: 'Search started successfully',
            searchId: searchRecord.id,
            apifyRunId,
            estimatedCredits,
            creditsPerLead,
            requestEnrichment,
            topUpTriggered: creditCheck.topUpTriggered,
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

        const userId = req.user.id;
        const { searchId } = req.params;

        const [searchRecord] = await db.select()
            .from(searchHistory)
            .where(and(
                eq(searchHistory.id, searchId),
                eq(searchHistory.userId, userId)
            ))
            .limit(1);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        if (searchRecord.status === 'running' && searchRecord.apifyRunId) {
            try {
                const apifyStatus = await getTaskStatus(searchRecord.apifyRunId);

                if (apifyStatus.status === 'SUCCEEDED') {
                    const results = await getTaskResults(searchRecord.apifyRunId);
                    const requestEnrichment = searchRecord.standardResultsCount === null
                        && searchRecord.enrichedResultsCount !== null;
                    const eligibleResults = requestEnrichment
                        ? results.filter((result) => hasValidEmail(result.email))
                        : results;

                    const [user] = await db.select()
                        .from(users)
                        .where(eq(users.id, userId))
                        .limit(1);

                    if (!user) {
                        res.status(404).json({ error: 'User not found' });
                        return;
                    }

                    const creditResult = await creditRulesService.consumeCredits(
                        userId,
                        eligibleResults.map(r => ({
                            placeId: r.placeId,
                            title: r.title,
                            email: r.email,
                            phone: r.phone,
                            address: r.address,
                            website: r.website,
                            category: r.category,
                            rating: r.rating,
                            reviewCount: r.reviewCount,
                            latitude: r.latitude,
                            longitude: r.longitude,
                        })),
                        searchRecord.id,
                        requestEnrichment
                    );

                    if (creditResult.creditsCharged > 0) {
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
                                updatedAt: new Date()
                            })
                            .where(eq(users.id, userId));

                        await db.insert(creditTransactions).values({
                            userId,
                            amount: -creditResult.creditsCharged,
                            type: 'usage',
                            description: `Search results: ${creditResult.standardResults} standard, ${creditResult.enrichedResults} enriched`,
                            searchId: searchRecord.id,
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
                            searchId: searchRecord.id,
                            metadata: {
                                standardResults: creditResult.standardResults,
                                enrichedResults: creditResult.enrichedResults,
                            },
                        });

                        await billingAlertService.checkCreditAlerts(userId);
                    }

                    if (eligibleResults.length > 0) {
                        const contactsToInsert = eligibleResults
                            .slice(0, creditResult.standardResults + creditResult.enrichedResults)
                            .map(place => ({
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

                        await db.insert(contacts).values(contactsToInsert);
                    }

                    await db.update(searchHistory)
                        .set({
                            status: 'completed',
                            totalResults: eligibleResults.length,
                            standardResultsCount: creditResult.standardResults,
                            enrichedResultsCount: creditResult.enrichedResults,
                            creditsUsed: creditResult.creditsCharged,
                            completedAt: new Date(),
                        })
                        .where(eq(searchHistory.id, searchRecord.id));

                    res.json({
                        status: 'completed',
                        totalResults: eligibleResults.length,
                        savedResults: creditResult.standardResults + creditResult.enrichedResults,
                        standardResults: creditResult.standardResults,
                        enrichedResults: creditResult.enrichedResults,
                        creditsUsed: creditResult.creditsCharged,
                        duplicatesSkipped: creditResult.duplicatesSkipped,
                    });
                    return;
                } else if (apifyStatus.status === 'FAILED' || apifyStatus.status === 'ABORTED') {
                    await db.update(searchHistory)
                        .set({ status: 'failed' })
                        .where(eq(searchHistory.id, searchRecord.id));

                    res.json({
                        status: 'failed',
                        message: 'Scraping task failed',
                    });
                    return;
                }

                res.json({
                    status: 'running',
                    progress: apifyStatus.progress,
                    itemsCount: apifyStatus.itemsCount,
                });
                return;
            } catch (apifyError) {
                console.error('Error checking Apify status:', apifyError);
            }
        }

        res.json({
            status: searchRecord.status,
            totalResults: searchRecord.totalResults,
            standardResults: searchRecord.standardResultsCount,
            enrichedResults: searchRecord.enrichedResultsCount,
            creditsUsed: searchRecord.creditsUsed,
            completedAt: searchRecord.completedAt,
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Internal server error' });
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

        res.json({ history });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:searchId', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { searchId } = req.params;

        const [searchRecord] = await db.select()
            .from(searchHistory)
            .where(and(
                eq(searchHistory.id, searchId),
                eq(searchHistory.userId, req.user.id)
            ))
            .limit(1);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        const searchContacts = await db.select()
            .from(contacts)
            .where(eq(contacts.searchId, searchId));

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

        const { searchId } = req.params;

        const [searchRecord] = await db.select()
            .from(searchHistory)
            .where(and(
                eq(searchHistory.id, searchId),
                eq(searchHistory.userId, req.user.id)
            ))
            .limit(1);

        if (!searchRecord) {
            res.status(404).json({ error: 'Search not found' });
            return;
        }

        await db.delete(contacts)
            .where(eq(contacts.searchId, searchId));

        await db.delete(searchHistory)
            .where(eq(searchHistory.id, searchId));

        res.json({ message: 'Search deleted successfully' });
    } catch (error) {
        console.error('Delete search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
