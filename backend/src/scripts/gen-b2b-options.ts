/**
 * One-off generator: fetches the live input schema of the B2B Leads actor and
 * writes b2bLeadsOptions.ts with the exact allowed values for every enum field.
 * Run: npx tsx src/scripts/gen-b2b-options.ts
 */
import { writeFileSync } from 'node:fs';
import { apifyClient } from '../services/apify.js';

const ACTOR_ID = 'IoSHqwTR9YGhzccez';

// schema field -> exported constant name in the generated file
const FIELD_TO_CONST: Record<string, string> = {
    seniority_level: 'SENIORITY_OPTIONS',
    functional_level: 'FUNCTIONAL_OPTIONS',
    size: 'COMPANY_SIZE_OPTIONS',
    email_status: 'EMAIL_STATUS_OPTIONS',
    min_revenue: 'REVENUE_OPTIONS',
    funding: 'FUNDING_OPTIONS',
    company_industry: 'INDUSTRY_OPTIONS',
    contact_location: 'LOCATION_OPTIONS',
};

function titleCase(s: string): string {
    return s
        .split(' ')
        .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ');
}

function labelFor(field: string, value: string): string {
    // Ranges / revenue bands read fine as-is.
    if (field === 'size' || field === 'min_revenue' || field === 'max_revenue') return value;
    // Underscore-coded enums -> spaced + title-cased ("series_a" -> "Series A").
    return titleCase(value.replace(/_/g, ' '));
}

// Some enums are huge (contact_location has ~1857 values incl. subdivisions).
// Cap the ones that would bloat the API/UI to the top-N (the actor lists them by
// data volume, so the first ~60 are the major countries).
const FIELD_LIMIT: Record<string, number> = {
    contact_location: 60,
};

function enumOf(prop: any): string[] | null {
    if (Array.isArray(prop?.enum)) return prop.enum;
    if (Array.isArray(prop?.items?.enum)) return prop.items.enum;
    return null;
}

async function main() {
    if (!apifyClient) throw new Error('APIFY_API_TOKEN not set');

    const actor = await apifyClient.actor(ACTOR_ID).get();
    const buildId = (actor as any)?.taggedBuilds?.latest?.buildId;
    const build = await apifyClient.build(buildId).get();
    const schema = typeof (build as any).inputSchema === 'string'
        ? JSON.parse((build as any).inputSchema)
        : (build as any).inputSchema;

    const props = schema.properties ?? {};
    const blocks: string[] = [];

    for (const [field, constName] of Object.entries(FIELD_TO_CONST)) {
        let values = enumOf(props[field]);
        if (!values) {
            console.warn(`⚠️  ${field}: no enum found, skipping`);
            continue;
        }
        const limit = FIELD_LIMIT[field];
        if (limit && values.length > limit) {
            values = values.slice(0, limit);
        }
        const entries = values
            .map((v) => `    { value: ${JSON.stringify(v)}, label: ${JSON.stringify(labelFor(field, v))} },`)
            .join('\n');
        blocks.push(`export const ${constName}: ScraperFormFieldOption[] = [\n${entries}\n];`);
        console.log(`✅ ${constName}: ${values.length} options`);
    }

    const header = `// AUTO-GENERATED from the Apify actor ${ACTOR_ID} input schema. Do not edit by hand.\n`
        + `// Regenerate with: npx tsx src/scripts/gen-b2b-options.ts\n`
        + `import type { ScraperFormFieldOption } from '../types.js';\n\n`;

    const out = header + blocks.join('\n\n') + '\n';
    const target = new URL('../services/scrapers/templates/b2bLeadsOptions.ts', import.meta.url);
    writeFileSync(target, out, 'utf8');
    console.log(`\n✅ Wrote ${target.pathname}`);
    process.exit(0);
}

main().catch((e) => {
    console.error('❌', e);
    process.exit(1);
});
