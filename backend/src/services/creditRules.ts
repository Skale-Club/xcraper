import { db } from '../db/index.js';
import { settings, contacts, users } from '../db/schema.js';
import { eq, and, gte, inArray } from 'drizzle-orm';
import type { NormalizedContact } from './scrapers/types.js';

export interface CreditPricingRules {
    creditsPerStandardResult: number;
    creditsPerEnrichedResult: number;
    enrichmentPricingMode: 'fixed' | 'base_plus_enrichment';
    chargeForDuplicates: boolean;
    duplicateWindowDays: number;
}

export interface ScrapingResult {
    placeId?: string;
    title: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    category?: string;
    rating?: number;
    reviewCount?: number;
    latitude?: number;
    longitude?: number;
    openingHours?: string;
    imageUrl?: string;
    googleMapsUrl?: string;
    rawData?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface CreditConsumptionResult {
    creditsCharged: number;
    breakdown: {
        base: number;
        enrichment: number;
    };
    standardResults: number;
    enrichedResults: number;
    duplicatesSkipped: number;
    acceptedResults: NormalizedContact[];
}

export interface ConsumeCreditsOptions {
    /** Credits charged per accepted result — comes from the scraper template. */
    creditsPerResult: number;
    /** Whether this scraper enriches (counts results as enriched for reporting). */
    isEnrichment: boolean;
}

export interface CreditEstimate {
    totalCredits: number;
    standardCredits: number;
    enrichmentCredits: number;
    standardResults: number;
    enrichedResults: number;
}

class CreditRulesService {
    private cachedRules: CreditPricingRules | null = null;
    private cacheExpiry: number = 0;
    private readonly CACHE_TTL = 60000; // 1 minute

    async getPricingRules(): Promise<CreditPricingRules> {
        if (this.cachedRules && Date.now() < this.cacheExpiry) {
            return this.cachedRules;
        }

        const [settingsRecord] = await db
            .select()
            .from(settings)
            .where(eq(settings.id, 'default'))
            .limit(1);

        this.cachedRules = {
            creditsPerStandardResult: settingsRecord?.creditsPerStandardResult ?? 1,
            creditsPerEnrichedResult: settingsRecord?.creditsPerEnrichedResult ?? 3,
            enrichmentPricingMode: (settingsRecord?.enrichmentPricingMode as 'fixed' | 'base_plus_enrichment') ?? 'fixed',
            chargeForDuplicates: settingsRecord?.chargeForDuplicates ?? false,
            duplicateWindowDays: settingsRecord?.duplicateWindowDays ?? 30,
        };
        this.cacheExpiry = Date.now() + this.CACHE_TTL;

        return this.cachedRules;
    }

    async updatePricingRules(updates: Partial<CreditPricingRules>): Promise<CreditPricingRules> {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        
        if (updates.creditsPerStandardResult !== undefined) {
            updateData.creditsPerStandardResult = updates.creditsPerStandardResult;
        }
        if (updates.creditsPerEnrichedResult !== undefined) {
            updateData.creditsPerEnrichedResult = updates.creditsPerEnrichedResult;
        }
        if (updates.enrichmentPricingMode !== undefined) {
            updateData.enrichmentPricingMode = updates.enrichmentPricingMode;
        }
        if (updates.chargeForDuplicates !== undefined) {
            updateData.chargeForDuplicates = updates.chargeForDuplicates;
        }
        if (updates.duplicateWindowDays !== undefined) {
            updateData.duplicateWindowDays = updates.duplicateWindowDays;
        }

        await db
            .update(settings)
            .set(updateData)
            .where(eq(settings.id, 'default'));

        this.cachedRules = null;
        return this.getPricingRules();
    }

    async estimateCredits(
        results: ScrapingResult[],
        requestEnrichment: boolean = false
    ): Promise<CreditEstimate> {
        const rules = await this.getPricingRules();
        
        let standardResults = 0;
        let enrichedResults = 0;
        let standardCredits = 0;
        let enrichmentCredits = 0;

        for (const result of results) {
            if (requestEnrichment) {
                enrichedResults++;
                if (rules.enrichmentPricingMode === 'base_plus_enrichment') {
                    standardCredits += rules.creditsPerStandardResult;
                    enrichmentCredits += rules.creditsPerEnrichedResult - rules.creditsPerStandardResult;
                } else {
                    enrichmentCredits += rules.creditsPerEnrichedResult;
                }
            } else {
                standardResults++;
                standardCredits += rules.creditsPerStandardResult;
            }
        }

        return {
            totalCredits: standardCredits + enrichmentCredits,
            standardCredits,
            enrichmentCredits,
            standardResults,
            enrichedResults,
        };
    }

    /**
     * Charge credits for a batch of scraped results. Template-agnostic: the price per
     * result and whether the scraper enriches come from the resolved template (opts),
     * while duplicate policy still comes from the global pricing rules.
     *
     * Dedup is by the generic `dedupeKey` (placeId for Maps, email/linkedin for leads),
     * so it works uniformly across every scraper source. Results are accepted until the
     * user's balance would be exceeded (then we stop) — never charging more than what
     * exists, never going negative.
     */
    async consumeCredits(
        userId: string,
        results: NormalizedContact[],
        searchId: string,
        opts: ConsumeCreditsOptions,
    ): Promise<CreditConsumptionResult> {
        const rules = await this.getPricingRules();

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        const totalCredits = user.credits + user.rolloverCredits + user.purchasedCredits;
        const creditCost = Math.max(0, opts.creditsPerResult);

        let duplicatesSkipped = 0;
        let standardResults = 0;
        let enrichedResults = 0;
        let baseCredits = 0;
        let enrichmentCredits = 0;
        const validResults: NormalizedContact[] = [];

        // Cross-search dedup against contacts the user already has within the window.
        const dedupeKeys = results
            .map((r) => r.dedupeKey)
            .filter((k): k is string => !!k);

        let existingKeys = new Set<string>();
        if (!rules.chargeForDuplicates && dedupeKeys.length > 0) {
            const duplicateWindow = new Date();
            duplicateWindow.setDate(duplicateWindow.getDate() - rules.duplicateWindowDays);

            const existingContacts = await db
                .select({ dedupeKey: contacts.dedupeKey })
                .from(contacts)
                .where(and(
                    eq(contacts.userId, userId),
                    inArray(contacts.dedupeKey, dedupeKeys),
                    gte(contacts.createdAt, duplicateWindow)
                ));

            existingKeys = new Set(existingContacts.map((c) => c.dedupeKey).filter((k): k is string => !!k));
        }

        for (const result of results) {
            if (!rules.chargeForDuplicates && result.dedupeKey && existingKeys.has(result.dedupeKey)) {
                duplicatesSkipped++;
                continue;
            }

            if (baseCredits + enrichmentCredits + creditCost > totalCredits) {
                break;
            }

            if (opts.isEnrichment) {
                enrichedResults++;
                enrichmentCredits += creditCost;
            } else {
                standardResults++;
                baseCredits += creditCost;
            }

            validResults.push(result);
        }

        return {
            creditsCharged: baseCredits + enrichmentCredits,
            breakdown: {
                base: baseCredits,
                enrichment: enrichmentCredits,
            },
            standardResults,
            enrichedResults,
            duplicatesSkipped,
            acceptedResults: validResults,
        };
    }

    async calculateEnrichmentCost(hasEmail: boolean): Promise<number> {
        const rules = await this.getPricingRules();
        
        if (!hasEmail) {
            return 0;
        }

        if (rules.enrichmentPricingMode === 'base_plus_enrichment') {
            return rules.creditsPerEnrichedResult - rules.creditsPerStandardResult;
        }
        
        return rules.creditsPerEnrichedResult;
    }

    async getUserCreditBalance(userId: string): Promise<{
        total: number;
        monthly: number;
        rollover: number;
        purchased: number;
    }> {
        const [user] = await db
            .select({
                credits: users.credits,
                rolloverCredits: users.rolloverCredits,
                purchasedCredits: users.purchasedCredits,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        return {
            total: user.credits + user.rolloverCredits + user.purchasedCredits,
            monthly: user.credits,
            rollover: user.rolloverCredits,
            purchased: user.purchasedCredits,
        };
    }

    async hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
        const balance = await this.getUserCreditBalance(userId);
        return balance.total >= requiredCredits;
    }

    private hasValidEmail(result: ScrapingResult): boolean {
        if (!result.email) return false;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(result.email);
    }
}

export const creditRulesService = new CreditRulesService();
export default creditRulesService;
