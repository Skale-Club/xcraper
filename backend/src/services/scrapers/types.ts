import type { ActorStartOptions } from 'apify-client';

/**
 * Scraper template registry — type definitions.
 *
 * The system is a *hybrid* catalog:
 *   - LOGIC (buildInput / mapResult / dedupeKey / inputSchema) lives in code, one
 *     template object per scraper, keyed by a stable `key`.
 *   - PARAMETERS (actor id, costs, credit price, limits, on/off) live in the
 *     `scraper_templates` DB table and are editable from the admin panel.
 *
 * At runtime the registry merges the two: code template + DB row → ResolvedScraper.
 */

export type ScraperSource = 'google_maps' | 'b2b_leads';
export type ScraperContactType = 'place' | 'b2b_lead';
export type ScraperBilling = 'pay_per_result' | 'pay_per_event';
export type ScraperFormFieldType = 'text' | 'tags' | 'select' | 'multiselect' | 'number';

export interface ScraperFormFieldOption {
    value: string;
    label: string;
}

/** A single field in a template's dynamic input form (rendered by the frontend). */
export interface ScraperFormField {
    key: string;
    type: ScraperFormFieldType;
    label: string;
    placeholder?: string;
    helpText?: string;
    required?: boolean;
    options?: ScraperFormFieldOption[];
    defaultValue?: unknown;
}

/** User-supplied search parameters. Each template reads only the fields it needs. */
export interface ScraperSearchParams {
    maxResults: number;
    language: string;
    countryCode: string;
    // Google Maps style (query + location)
    query?: string;
    location?: string;
    // Structured filters (e.g. B2B leads: jobTitles, industries, ...)
    filters?: Record<string, unknown>;
}

/** Global Apify economics, shared across every template. */
export interface ScraperGlobalConfig {
    baseRunCostUsd: number;
    minRunChargeUsd: number;
    defaultSearchLanguage: string;
    defaultSearchCountryCode: string;
}

/** Per-template parameters — code defaults, overridable by the `scraper_templates` table. */
export interface ScraperRuntimeParams {
    actorId: string;
    actorName: string;
    costPerResultUsd: number;
    fixedStartCostUsd: number;
    memoryMb: number;
    creditsPerResult: number;
    minResults: number;
    maxResults: number;
    isActive: boolean;
}

/**
 * Normalized contact — the unified shape every template maps into. Mirrors the
 * `contacts` table columns. `place` scrapers fill the place fields; `b2b_lead`
 * scrapers fill the B2B fields. `dedupeKey` is transient (not persisted as-is —
 * it's written to the `dedupe_key` column).
 */
export interface NormalizedContact {
    contactType: ScraperContactType;
    title: string;
    category?: string;
    address?: string;
    phone?: string;
    website?: string;
    email?: string;

    // Place-specific
    rating?: number;
    reviewCount?: number;
    latitude?: number;
    longitude?: number;
    openingHours?: string;
    imageUrl?: string;
    googleMapsUrl?: string;
    placeId?: string;

    // Social media
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
    pinterest?: string;

    // B2B-specific
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    seniority?: string;
    personalEmail?: string;
    companyName?: string;
    companyDomain?: string;
    companyLinkedin?: string;
    companySize?: string;
    industry?: string;
    companyRevenue?: string;
    companyFunding?: string;

    rawData?: Record<string, unknown>;
    dedupeKey?: string;
}

export interface ScraperTemplate {
    /** Stable identifier — must match the `scraper_templates.key` column. */
    key: string;
    source: ScraperSource;
    contactType: ScraperContactType;
    label: string;
    description: string;
    billing: ScraperBilling;
    extractsEmails: boolean;

    /** Schema the frontend uses to render the search form for this scraper. */
    inputSchema: ScraperFormField[];

    /** Code defaults used to seed the DB and as a fallback before seeding. */
    defaults: ScraperRuntimeParams;

    /** Build the Apify actor input from user params. */
    buildInput(params: ScraperSearchParams, runtime: ScraperRuntimeParams): Record<string, unknown>;

    /** Build the Apify start options (memory + maxTotalChargeUsd cost ceiling). */
    buildStartOptions(
        params: ScraperSearchParams,
        runtime: ScraperRuntimeParams,
        global: ScraperGlobalConfig,
    ): ActorStartOptions;

    /** Normalize a single raw dataset item into the unified contact shape. */
    mapResult(item: Record<string, unknown>): NormalizedContact;

    /** A stable dedupe key for this contact, or undefined when not dedupable. */
    dedupeKey(contact: NormalizedContact): string | undefined;
}

/** A code template merged with its DB params + global Apify economics. */
export interface ResolvedScraper {
    template: ScraperTemplate;
    runtime: ScraperRuntimeParams;
    global: ScraperGlobalConfig;
}
