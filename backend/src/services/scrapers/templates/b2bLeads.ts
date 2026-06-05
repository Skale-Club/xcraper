import type { ActorStartOptions } from 'apify-client';
import type {
    ScraperTemplate,
    ScraperSearchParams,
    ScraperRuntimeParams,
    ScraperGlobalConfig,
    NormalizedContact,
} from '../types.js';
import { getFirstString, getNumber, pruneEmpty, toStringArray } from '../helpers.js';

/**
 * B2B Leads Finder — Apollo/ZoomInfo-style people+company search.
 * Actor: code_crafter/leads-finder (IoSHqwTR9YGhzccez), pay-per-event (~$1.5/1k leads).
 *
 * NOTE: This is a different data SOURCE than Google Maps — output is a person inside a
 * company, not a place. It maps onto the B2B columns of the contacts table.
 *
 * Apify free-plan caveats (handled via the runtime params / admin):
 *   - capped at 100 leads/run
 *   - mobile_number only enriched on paid Apify plans
 */

// Option lists mirror the actor's documented filter values. Some may need lowercasing
// against the live actor — they're editable here without touching the rest of the system.
const SENIORITY_OPTIONS = [
    'Founder', 'Owner', 'C-Level', 'Director', 'VP', 'Head', 'Manager', 'Senior', 'Entry', 'Trainee',
].map((v) => ({ value: v, label: v }));

const COMPANY_SIZE_OPTIONS = [
    '0-1', '2-10', '11-20', '21-50', '51-100', '101-200', '201-500', '501-1000', '1001-2000', '2001-5000', '10000+',
].map((v) => ({ value: v, label: v }));

const EMAIL_STATUS_OPTIONS = [
    { value: 'validated', label: 'Validated' },
    { value: 'unknown', label: 'Unknown' },
    { value: 'not_validated', label: 'Not validated' },
];

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
    label: 'B2B Leads (Apollo-style)',
    description: 'Find decision-makers by job title, seniority, industry and company size — with verified emails and LinkedIn profiles.',
    billing: 'pay_per_event',
    extractsEmails: true,

    inputSchema: [
        { key: 'jobTitles', type: 'tags', label: 'Job titles', placeholder: 'e.g. Head of Marketing, CMO', helpText: 'Add one or more titles to target.' },
        { key: 'seniority', type: 'multiselect', label: 'Seniority', options: SENIORITY_OPTIONS },
        { key: 'industries', type: 'tags', label: 'Industry', placeholder: 'e.g. SaaS, marketing & advertising' },
        { key: 'companySizes', type: 'multiselect', label: 'Company size', options: COMPANY_SIZE_OPTIONS },
        { key: 'locations', type: 'tags', label: 'Location (country / state / region)', placeholder: 'e.g. United States, California' },
        { key: 'cities', type: 'tags', label: 'Cities', placeholder: 'e.g. Amsterdam', helpText: 'Use cities for city-level targeting only (leave Location empty).' },
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
