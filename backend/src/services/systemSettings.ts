import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { systemSettings, type SystemSettings } from '../db/schema.js';

export interface PublicRuntimeSettings {
    googleMapsApiKey: string | null;
    sentryDsn: string | null;
    pwaName: string;
    pwaShortName: string;
    pwaDescription: string;
    pwaThemeColor: string;
    pwaBackgroundColor: string;
    pwaIcon192Url: string | null;
    pwaIcon512Url: string | null;
    pwaMaskableIcon512Url: string | null;
    pwaAppleTouchIconUrl: string | null;
}

export interface ApifyActorRuntimeConfig {
    actorId: string;
    actorName: string;
    costPerResultUsd: number;
    fixedStartCostUsd: number;
    memoryMb: number;
}

export interface ApifyRuntimeConfig {
    baseRunCostUsd: number;
    minRunChargeUsd: number;
    defaultSearchLanguage: string;
    defaultSearchCountryCode: string;
    standard: ApifyActorRuntimeConfig;
    enriched: ApifyActorRuntimeConfig;
}

const DEFAULT_ID = 'default';

function parseDecimal(value: string | null | undefined, fallback: number): number {
    if (value === null || value === undefined) {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const DEFAULT_SYSTEM_SETTINGS: typeof systemSettings.$inferInsert = {
    id: DEFAULT_ID,
};

class SystemSettingsService {
    private cachedSettings: SystemSettings | null = null;
    private cacheExpiry = 0;
    private readonly cacheTtlMs = 60_000;

    private invalidateCache() {
        this.cachedSettings = null;
        this.cacheExpiry = 0;
    }

    async ensureExists(): Promise<SystemSettings> {
        let [record] = await db
            .select()
            .from(systemSettings)
            .where(eq(systemSettings.id, DEFAULT_ID))
            .limit(1);

        if (!record) {
            [record] = await db.insert(systemSettings).values(DEFAULT_SYSTEM_SETTINGS).returning();
        }

        return record;
    }

    async getSettings(): Promise<SystemSettings> {
        if (this.cachedSettings && Date.now() < this.cacheExpiry) {
            return this.cachedSettings;
        }

        const record = await this.ensureExists();
        this.cachedSettings = record;
        this.cacheExpiry = Date.now() + this.cacheTtlMs;
        return record;
    }

    async updateSettings(updates: Partial<typeof systemSettings.$inferInsert>): Promise<SystemSettings> {
        await this.ensureExists();

        const sanitizedUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, value]) => value !== undefined),
        );

        const [updated] = await db
            .update(systemSettings)
            .set({
                ...sanitizedUpdates,
                updatedAt: new Date(),
            })
            .where(eq(systemSettings.id, DEFAULT_ID))
            .returning();

        this.invalidateCache();
        if (!updated) {
            throw new Error('Failed to update system settings');
        }
        return updated;
    }

    async getPublicRuntimeSettings(): Promise<PublicRuntimeSettings> {
        const record = await this.getSettings();

        return {
            googleMapsApiKey: record.publicGoogleMapsApiKey ?? null,
            sentryDsn: record.publicSentryDsn ?? null,
            pwaName: record.pwaName,
            pwaShortName: record.pwaShortName,
            pwaDescription: record.pwaDescription,
            pwaThemeColor: record.pwaThemeColor,
            pwaBackgroundColor: record.pwaBackgroundColor,
            pwaIcon192Url: record.pwaIcon192Url ?? null,
            pwaIcon512Url: record.pwaIcon512Url ?? null,
            pwaMaskableIcon512Url: record.pwaMaskableIcon512Url ?? null,
            pwaAppleTouchIconUrl: record.pwaAppleTouchIconUrl ?? null,
        };
    }

    async getApifyConfig(): Promise<ApifyRuntimeConfig> {
        const record = await this.getSettings();

        return {
            baseRunCostUsd: parseDecimal(record.apifyBaseRunCostUsd, 0.02),
            minRunChargeUsd: parseDecimal(record.apifyMinRunChargeUsd, 0.5),
            defaultSearchLanguage: record.defaultSearchLanguage,
            defaultSearchCountryCode: record.defaultSearchCountryCode,
            standard: {
                actorId: record.apifyStandardActorId,
                actorName: record.apifyStandardActorName,
                costPerResultUsd: parseDecimal(record.apifyStandardCostPerResultUsd, 0.004),
                fixedStartCostUsd: parseDecimal(record.apifyStandardFixedStartCostUsd, 0.007),
                memoryMb: record.apifyStandardMemoryMb,
            },
            enriched: {
                actorId: record.apifyEnrichedActorId,
                actorName: record.apifyEnrichedActorName,
                costPerResultUsd: parseDecimal(record.apifyEnrichedCostPerResultUsd, 0.009),
                fixedStartCostUsd: parseDecimal(record.apifyEnrichedFixedStartCostUsd, 0),
                memoryMb: record.apifyEnrichedMemoryMb,
            },
        };
    }
}

export const systemSettingsService = new SystemSettingsService();
export default systemSettingsService;
