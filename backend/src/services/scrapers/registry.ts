import { db } from '../../db/index.js';
import { scraperTemplates, type ScraperTemplateRow, type NewScraperTemplateRow } from '../../db/schema.js';
import { systemSettingsService } from '../systemSettings.js';
import { logger } from '../../utils/logger.js';
import { standardTemplate } from './templates/standard.js';
import { enrichedTemplate } from './templates/enriched.js';
import { b2bLeadsTemplate } from './templates/b2bLeads.js';
import type {
    ScraperTemplate,
    ScraperRuntimeParams,
    ScraperGlobalConfig,
    ResolvedScraper,
} from './types.js';

/**
 * Code half of the hybrid registry — the LOGIC, keyed by template key.
 * Order here is the default display order when seeding the DB.
 */
const CODE_TEMPLATES: ScraperTemplate[] = [standardTemplate, enrichedTemplate, b2bLeadsTemplate];
const CODE_TEMPLATE_MAP: Record<string, ScraperTemplate> = Object.fromEntries(
    CODE_TEMPLATES.map((t) => [t.key, t]),
);

function num(value: string | number | null | undefined, fallback: number): number {
    if (value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function rowToRuntime(row: ScraperTemplateRow): ScraperRuntimeParams {
    return {
        actorId: row.actorId,
        actorName: row.actorName,
        costPerResultUsd: num(row.costPerResultUsd, 0),
        fixedStartCostUsd: num(row.fixedStartCostUsd, 0),
        memoryMb: row.memoryMb,
        creditsPerResult: row.creditsPerResult,
        minResults: row.minResults,
        maxResults: row.maxResults,
        isActive: row.isActive,
    };
}

/** Build a DB insert row from a code template's defaults. */
export function templateToSeedRow(template: ScraperTemplate, displayOrder: number): NewScraperTemplateRow {
    const d = template.defaults;
    return {
        key: template.key,
        source: template.source,
        label: template.label,
        description: template.description,
        actorId: d.actorId,
        actorName: d.actorName,
        billing: template.billing,
        costPerResultUsd: d.costPerResultUsd.toFixed(6),
        fixedStartCostUsd: d.fixedStartCostUsd.toFixed(6),
        memoryMb: d.memoryMb,
        creditsPerResult: d.creditsPerResult,
        minResults: d.minResults,
        maxResults: d.maxResults,
        extractsEmails: template.extractsEmails,
        isActive: d.isActive,
        displayOrder,
    };
}

class ScraperRegistry {
    private cache: Map<string, ScraperRuntimeParams> | null = null;
    private cacheExpiry = 0;
    private readonly ttlMs = 60_000;

    /** All code templates (logic). */
    listTemplates(): ScraperTemplate[] {
        return CODE_TEMPLATES;
    }

    getTemplate(key: string): ScraperTemplate | undefined {
        return CODE_TEMPLATE_MAP[key];
    }

    invalidate(): void {
        this.cache = null;
        this.cacheExpiry = 0;
    }

    /**
     * Runtime params per key from the DB, cached 60s. If the table is missing
     * (migration not run yet) or a key isn't seeded, callers fall back to code defaults.
     */
    private async getRuntimeMap(): Promise<Map<string, ScraperRuntimeParams>> {
        if (this.cache && Date.now() < this.cacheExpiry) {
            return this.cache;
        }

        const map = new Map<string, ScraperRuntimeParams>();
        try {
            const rows = await db.select().from(scraperTemplates);
            for (const row of rows) {
                map.set(row.key, rowToRuntime(row));
            }
        } catch (error) {
            // Table likely doesn't exist yet — degrade gracefully to code defaults.
            logger.warn(`scraper_templates unavailable, using code defaults: ${error instanceof Error ? error.message : 'unknown'}`);
        }

        this.cache = map;
        this.cacheExpiry = Date.now() + this.ttlMs;
        return map;
    }

    private async getGlobal(): Promise<ScraperGlobalConfig> {
        const apify = await systemSettingsService.getApifyConfig();
        return {
            baseRunCostUsd: apify.baseRunCostUsd,
            minRunChargeUsd: apify.minRunChargeUsd,
            defaultSearchLanguage: apify.defaultSearchLanguage,
            defaultSearchCountryCode: apify.defaultSearchCountryCode,
        };
    }

    /** Resolve a single scraper (template + runtime params + global economics). */
    async resolve(key: string): Promise<ResolvedScraper> {
        const template = CODE_TEMPLATE_MAP[key];
        if (!template) {
            throw new Error(`Unknown scraper template: "${key}"`);
        }
        const runtimeMap = await this.getRuntimeMap();
        const runtime = runtimeMap.get(key) ?? template.defaults;
        const global = await this.getGlobal();
        return { template, runtime, global };
    }

    /** Active scrapers (DB isActive, or code default when not seeded), in display order. */
    async listActive(): Promise<ResolvedScraper[]> {
        const runtimeMap = await this.getRuntimeMap();
        const global = await this.getGlobal();
        const resolved: ResolvedScraper[] = [];
        for (const template of CODE_TEMPLATES) {
            const runtime = runtimeMap.get(template.key) ?? template.defaults;
            if (runtime.isActive) {
                resolved.push({ template, runtime, global });
            }
        }
        return resolved;
    }
}

export const scraperRegistry = new ScraperRegistry();
export default scraperRegistry;
