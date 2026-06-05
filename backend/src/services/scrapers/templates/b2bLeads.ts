import type { ActorStartOptions } from 'apify-client';
import type {
    ScraperTemplate,
    ScraperSearchParams,
    ScraperRuntimeParams,
    ScraperGlobalConfig,
    NormalizedContact,
} from '../types.js';
import { getFirstString, pruneEmpty, toStringArray } from '../helpers.js';
import {
    SENIORITY_OPTIONS,
    COMPANY_SIZE_OPTIONS,
    EMAIL_STATUS_OPTIONS,
    FUNDING_OPTIONS,
    INDUSTRY_OPTIONS,
    LOCATION_OPTIONS,
} from './b2bLeadsOptions.js';

/**
 * B2B Leads Finder — people + company search (job title, seniority, industry,
 * company size) with verified emails and LinkedIn profiles.
 * Actor: code_crafter/leads-finder (IoSHqwTR9YGhzccez), pay-per-event (~$1.5/1k leads).
 *
 * The filter option values (seniority, size, industry, country, funding, email status)
 * come straight from the actor's input schema (see scripts/gen-b2b-options.ts) so the
 * actor never rejects them. Country/industry are large closed lists -> combobox.
 *
 * Apify free-plan caveats (handled via runtime params / admin):
 *   - capped at 100 leads/run
 *   - mobile_number only enriched on paid Apify plans
 */

function joinLocation(item: Record<string, unknown>): string | undefined {
    const full = getFirstString(item.company_full_address);
    if (full) return full;
    const parts = [item.city, item.state, item.country]
        .map((p) => getFirstString(p))
        .filter((p): p is string => !!p);
    return parts.length > 0 ? parts.join(', ') : undefined;
}

function mapLead(item: Record<string, unknown>): NormalizedContact {
    const firstName = getFirstString(item.first_name);
    const lastName = getFirstString(item.last_name);
    const fullName = getFirstString(item.full_name) || [firstName, lastName].filter(Boolean).join(' ').trim();

    return {
        contactType: 'b2b_lead',
        title: fullName || getFirstString(item.company_name) || '',
        category: getFirstString(item.headline) || getFirstString(item.industry),
        address: joinLocation(item),
        // mobile_number is paid-plan only; fall back to company phone
        phone: getFirstString(item.mobile_number) || getFirstString(item.company_phone),
        website: getFirstString(item.company_website) || getFirstString(item.company_domain),
        email: getFirstString(item.email),
        // person
        firstName,
        lastName,
        jobTitle: getFirstString(item.job_title),
        seniority: getFirstString(item.seniority_level),
        personalEmail: getFirstString(item.personal_email),
        linkedin: getFirstString(item.linkedin),
        // company
        companyName: getFirstString(item.company_name),
        companyDomain: getFirstString(item.company_domain),
        companyLinkedin: getFirstString(item.company_linkedin),
        companySize: getFirstString(item.company_size),
        industry: getFirstString(item.industry),
        companyRevenue: getFirstString(item.company_annual_revenue_clean) || getFirstString(item.company_annual_revenue),
        companyFunding: getFirstString(item.company_total_funding_clean) || getFirstString(item.company_total_funding),
        rawData: item,
    };
}

export const b2bLeadsTemplate: ScraperTemplate = {
    key: 'b2b_leads',
    source: 'b2b_leads',
    contactType: 'b2b_lead',
    label: 'B2B Leads',
    description: 'Find decision-makers by job title, seniority, industry and company size — with verified emails and LinkedIn profiles.',
    billing: 'pay_per_event',
    extractsEmails: true,

    inputSchema: [
        { key: 'jobTitles', type: 'tags', label: 'Job titles', placeholder: 'e.g. Head of Marketing, CMO', helpText: 'Free text — add one or more titles.' },
        { key: 'seniority', type: 'multiselect', label: 'Seniority', options: SENIORITY_OPTIONS },
        { key: 'industries', type: 'combobox', label: 'Industry', options: INDUSTRY_OPTIONS, placeholder: 'Search industries…' },
        { key: 'companySizes', type: 'multiselect', label: 'Company size (employees)', options: COMPANY_SIZE_OPTIONS },
        { key: 'locations', type: 'combobox', label: 'Country / region', options: LOCATION_OPTIONS, placeholder: 'Search countries…', helpText: 'Top countries by data volume. For a single city, leave this empty and use Cities.' },
        { key: 'cities', type: 'tags', label: 'Cities', placeholder: 'e.g. Amsterdam' },
        { key: 'funding', type: 'multiselect', label: 'Funding stage', options: FUNDING_OPTIONS },
        { key: 'emailStatus', type: 'multiselect', label: 'Email quality', options: EMAIL_STATUS_OPTIONS, defaultValue: ['validated'] },
    ],

    defaults: {
        actorId: 'IoSHqwTR9YGhzccez',
        actorName: 'Leads Finder (code_crafter)',
        costPerResultUsd: 0.0015,
        fixedStartCostUsd: 0,
        memoryMb: 1024,
        creditsPerResult: 2,
        minResults: 10,
        maxResults: 100, // Apify free-plan cap; raise after upgrading the Apify plan
        isActive: true,
    },

    buildInput(params: ScraperSearchParams): Record<string, unknown> {
        const f = params.filters ?? {};
        return pruneEmpty({
            contact_job_title: toStringArray(f.jobTitles),
            seniority_level: toStringArray(f.seniority),
            company_industry: toStringArray(f.industries),
            size: toStringArray(f.companySizes),
            contact_location: toStringArray(f.locations),
            contact_city: toStringArray(f.cities),
            funding: toStringArray(f.funding),
            email_status: toStringArray(f.emailStatus) ?? ['validated'],
            fetch_count: params.maxResults,
        });
    },

    buildStartOptions(
        params: ScraperSearchParams,
        runtime: ScraperRuntimeParams,
        global: ScraperGlobalConfig,
    ): ActorStartOptions {
        // Pay-per-event: maxTotalChargeUsd is a hard ceiling on platform usage for the run.
        // Sized off the per-lead cost (not the Maps base cost) with headroom, floored at the
        // global minimum so it can never be set below a sane safety ceiling.
        const projected = runtime.fixedStartCostUsd + params.maxResults * runtime.costPerResultUsd * 1.25;
        return {
            memory: runtime.memoryMb,
            maxTotalChargeUsd: Number(Math.max(global.minRunChargeUsd, projected).toFixed(3)),
        };
    },

    mapResult: mapLead,

    dedupeKey(contact) {
        if (contact.email) return `email:${contact.email.toLowerCase()}`;
        if (contact.linkedin) return `li:${contact.linkedin.toLowerCase()}`;
        if (contact.title && contact.companyDomain) {
            return `nc:${contact.title.toLowerCase()}|${contact.companyDomain.toLowerCase()}`;
        }
        return undefined;
    },
};

export { mapLead };
