/**
 * Migration: scraper templates + B2B contact fields.
 *
 * Idempotent — safe to run multiple times. Applies the schema changes for the
 * templatized scraping system and backfills existing rows so dedup and history
 * keep working for data created before the migration.
 *
 *   npm run db:migrate:scrapers --workspace=backend
 */
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { scraperTemplates } from '../db/schema.js';
import { scraperRegistry, templateToSeedRow } from '../services/scrapers/registry.js';

async function run(label: string, statement: ReturnType<typeof sql.raw>) {
    await db.execute(statement);
    console.log(`✅ ${label}`);
}

async function migrate() {
    console.log('📝 Migrating scraper templates + B2B contact fields...\n');

    // 1) search_history: scraper selector + structured filters
    await run('search_history.scrape_type', sql.raw(
        `ALTER TABLE search_history ADD COLUMN IF NOT EXISTS scrape_type TEXT NOT NULL DEFAULT 'standard';`,
    ));
    await run('search_history.search_filters', sql.raw(
        `ALTER TABLE search_history ADD COLUMN IF NOT EXISTS search_filters JSONB;`,
    ));
    // Backfill: legacy enriched searches → 'enriched' (default already covers 'standard')
    await run('backfill search_history.scrape_type', sql.raw(
        `UPDATE search_history SET scrape_type = 'enriched'
         WHERE request_enrichment = true AND scrape_type = 'standard';`,
    ));

    // 2) contacts: discriminator + B2B fields + generic dedupe key
    await run('contacts.contact_type', sql.raw(
        `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'place';`,
    ));
    const b2bColumns = [
        'first_name', 'last_name', 'job_title', 'seniority', 'personal_email',
        'company_name', 'company_domain', 'company_linkedin', 'company_size',
        'industry', 'company_revenue', 'company_funding', 'dedupe_key',
    ];
    for (const col of b2bColumns) {
        await run(`contacts.${col}`, sql.raw(
            `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ${col} TEXT;`,
        ));
    }
    // Backfill dedupe_key from place_id so existing places keep deduping
    await run('backfill contacts.dedupe_key', sql.raw(
        `UPDATE contacts SET dedupe_key = place_id
         WHERE dedupe_key IS NULL AND place_id IS NOT NULL AND place_id <> '';`,
    ));
    // Index to keep dedup lookups fast
    await run('index contacts.dedupe_key', sql.raw(
        `CREATE INDEX IF NOT EXISTS contacts_user_dedupe_key_idx
         ON contacts (user_id, dedupe_key);`,
    ));

    // 3) scraper_templates table
    await run('table scraper_templates', sql.raw(`
        CREATE TABLE IF NOT EXISTS scraper_templates (
            key TEXT PRIMARY KEY,
            source TEXT NOT NULL DEFAULT 'google_maps',
            label TEXT NOT NULL,
            description TEXT,
            actor_id TEXT NOT NULL,
            actor_name TEXT NOT NULL,
            billing TEXT NOT NULL DEFAULT 'pay_per_result',
            cost_per_result_usd NUMERIC(10,6) NOT NULL DEFAULT 0.004000,
            fixed_start_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0.000000,
            memory_mb INTEGER NOT NULL DEFAULT 2048,
            credits_per_result INTEGER NOT NULL DEFAULT 1,
            min_results INTEGER NOT NULL DEFAULT 10,
            max_results INTEGER NOT NULL DEFAULT 500,
            extracts_emails BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
    `));

    // 4) Seed the three code templates (does NOT overwrite admin edits)
    const rows = scraperRegistry.listTemplates().map((t, i) => templateToSeedRow(t, i));
    await db.insert(scraperTemplates).values(rows).onConflictDoNothing();
    console.log(`✅ Seeded ${rows.length} scraper templates (existing rows untouched)`);

    console.log('\n✅ Migration complete.');
}

migrate()
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exitCode = 1;
    })
    .finally(() => process.exit());
