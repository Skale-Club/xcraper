import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
    const client = await pool.connect();
    try {
        console.log('Starting billing schema migration...');

        // Create enums
        const enums = [
            { name: 'subscription_status', values: ['active', 'canceled', 'past_due', 'incomplete', 'trialing', 'unpaid'] },
            { name: 'billing_interval', values: ['monthly', 'yearly'] },
            { name: 'credit_transaction_type', values: ['monthly_grant', 'purchase', 'usage', 'refund', 'bonus', 'top_up', 'rollover', 'expired', 'adjustment', 'compensation', 'promotional'] },
            { name: 'billing_event_type', values: ['monthly_grant', 'consumption', 'top_up', 'purchase', 'refund', 'adjustment', 'rollover', 'expiration', 'compensation', 'promotional'] },
            { name: 'billing_alert_type', values: ['credits_80', 'credits_100', 'topup_success', 'topup_failed', 'cap_80', 'cap_100', 'renewal_success', 'renewal_failed', 'payment_method_expiring'] },
            { name: 'account_risk_flag', values: ['none', 'review', 'restricted', 'suspended'] },
        ];

        for (const enumDef of enums) {
            await client.query(`
                DO $$ BEGIN
                    CREATE TYPE ${enumDef.name} AS ENUM (${enumDef.values.map(v => `'${v}'`).join(', ')});
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            console.log(`Created/verified enum: ${enumDef.name}`);
        }

        // Check if subscription_plans table exists
        const { rows: tableCheck } = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'subscription_plans'
        `);

        if (tableCheck.length === 0) {
            // Create subscription_plans table
            await client.query(`
                CREATE TABLE subscription_plans (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT NOT NULL,
                    description TEXT,
                    display_order INTEGER NOT NULL DEFAULT 0,
                    price DECIMAL(10, 2) NOT NULL,
                    billing_interval billing_interval NOT NULL DEFAULT 'monthly',
                    monthly_credits INTEGER NOT NULL DEFAULT 500,
                    stripe_price_id TEXT,
                    stripe_product_id TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    is_public BOOLEAN NOT NULL DEFAULT true,
                    allow_auto_top_up BOOLEAN NOT NULL DEFAULT true,
                    allow_manual_purchase BOOLEAN NOT NULL DEFAULT true,
                    allow_overage BOOLEAN NOT NULL DEFAULT true,
                    default_top_up_credits INTEGER DEFAULT 250,
                    default_top_up_price DECIMAL(10, 2) DEFAULT '5.90',
                    default_monthly_top_up_cap DECIMAL(10, 2) DEFAULT '20.00',
                    top_up_threshold INTEGER DEFAULT 50,
                    allow_rollover BOOLEAN NOT NULL DEFAULT false,
                    max_rollover_credits INTEGER,
                    rollover_expiration_days INTEGER,
                    trial_days INTEGER,
                    trial_credits INTEGER,
                    internal_notes TEXT,
                    estimated_cost_per_credit DECIMAL(10, 6),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            `);
            console.log('Created subscription_plans table');
        } else {
            console.log('subscription_plans table already exists');
        }

        // Get existing users columns
        const { rows: usersColumns } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND table_schema = 'public'
        `);
        const existingUsersColumns = usersColumns.map(r => r.column_name);

        const usersColumnsToAdd = [
            { name: 'rollover_credits', sql: 'ADD COLUMN IF NOT EXISTS rollover_credits INTEGER NOT NULL DEFAULT 0' },
            { name: 'purchased_credits', sql: 'ADD COLUMN IF NOT EXISTS purchased_credits INTEGER NOT NULL DEFAULT 0' },
            { name: 'subscription_plan_id', sql: 'ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES subscription_plans(id)' },
            { name: 'subscription_status', sql: "ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT 'incomplete'" },
            { name: 'stripe_customer_id', sql: 'ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT' },
            { name: 'stripe_subscription_id', sql: 'ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT' },
            { name: 'billing_cycle_start', sql: 'ADD COLUMN IF NOT EXISTS billing_cycle_start TIMESTAMP' },
            { name: 'billing_cycle_end', sql: 'ADD COLUMN IF NOT EXISTS billing_cycle_end TIMESTAMP' },
            { name: 'monthly_credits_used', sql: 'ADD COLUMN IF NOT EXISTS monthly_credits_used INTEGER NOT NULL DEFAULT 0' },
            { name: 'top_ups_this_cycle', sql: 'ADD COLUMN IF NOT EXISTS top_ups_this_cycle INTEGER NOT NULL DEFAULT 0' },
            { name: 'auto_top_up_enabled', sql: 'ADD COLUMN IF NOT EXISTS auto_top_up_enabled BOOLEAN NOT NULL DEFAULT true' },
            { name: 'monthly_top_up_cap', sql: "ADD COLUMN IF NOT EXISTS monthly_top_up_cap DECIMAL(10, 2) DEFAULT '20.00'" },
            { name: 'current_month_top_up_spend', sql: "ADD COLUMN IF NOT EXISTS current_month_top_up_spend DECIMAL(10, 2) DEFAULT '0.00'" },
            { name: 'top_up_threshold', sql: 'ADD COLUMN IF NOT EXISTS top_up_threshold INTEGER DEFAULT 50' },
            { name: 'top_up_block_credits', sql: 'ADD COLUMN IF NOT EXISTS top_up_block_credits INTEGER DEFAULT 250' },
            { name: 'top_up_block_price', sql: "ADD COLUMN IF NOT EXISTS top_up_block_price DECIMAL(10, 2) DEFAULT '5.90'" },
            { name: 'cap_override', sql: 'ADD COLUMN IF NOT EXISTS cap_override DECIMAL(10, 2)' },
            { name: 'hard_usage_stop', sql: 'ADD COLUMN IF NOT EXISTS hard_usage_stop BOOLEAN NOT NULL DEFAULT false' },
            { name: 'account_risk_flag', sql: "ADD COLUMN IF NOT EXISTS account_risk_flag account_risk_flag NOT NULL DEFAULT 'none'" },
            { name: 'support_notes', sql: 'ADD COLUMN IF NOT EXISTS support_notes TEXT' },
        ];

        for (const col of usersColumnsToAdd) {
            if (!existingUsersColumns.includes(col.name)) {
                await client.query(`ALTER TABLE users ${col.sql}`);
                console.log(`Added column ${col.name} to users table`);
            }
        }

        // Create billing_events table
        const { rows: billingEventsCheck } = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'billing_events'
        `);

        if (billingEventsCheck.length === 0) {
            await client.query(`
                CREATE TABLE billing_events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    event_type billing_event_type NOT NULL,
                    credit_delta INTEGER NOT NULL,
                    money_amount DECIMAL(10, 2),
                    currency TEXT DEFAULT 'usd',
                    search_id UUID REFERENCES search_history(id) ON DELETE SET NULL,
                    stripe_payment_intent_id TEXT,
                    stripe_invoice_id TEXT,
                    subscription_plan_id UUID REFERENCES subscription_plans(id),
                    metadata JSONB,
                    admin_id UUID,
                    reason TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            `);
            console.log('Created billing_events table');
        }

        // Create billing_alerts table
        const { rows: billingAlertsCheck } = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'billing_alerts'
        `);

        if (billingAlertsCheck.length === 0) {
            await client.query(`
                CREATE TABLE billing_alerts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    alert_type billing_alert_type NOT NULL,
                    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    metadata JSONB
                );
            `);
            console.log('Created billing_alerts table');
        }

        // Create usage_summary table
        const { rows: usageSummaryCheck } = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'usage_summary'
        `);

        if (usageSummaryCheck.length === 0) {
            await client.query(`
                CREATE TABLE usage_summary (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    period_start TIMESTAMP NOT NULL,
                    period_end TIMESTAMP NOT NULL,
                    jobs_submitted INTEGER NOT NULL DEFAULT 0,
                    jobs_completed INTEGER NOT NULL DEFAULT 0,
                    jobs_failed INTEGER NOT NULL DEFAULT 0,
                    standard_results INTEGER NOT NULL DEFAULT 0,
                    enriched_results INTEGER NOT NULL DEFAULT 0,
                    credits_consumed INTEGER NOT NULL DEFAULT 0,
                    top_up_credits INTEGER NOT NULL DEFAULT 0,
                    top_up_revenue DECIMAL(10, 2) DEFAULT '0.00',
                    purchase_credits INTEGER NOT NULL DEFAULT 0,
                    purchase_revenue DECIMAL(10, 2) DEFAULT '0.00',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            `);
            console.log('Created usage_summary table');
        }

        // Add columns to credit_packages
        const { rows: pkgColumns } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'credit_packages' AND table_schema = 'public'
        `);
        const existingPkgColumns = pkgColumns.map(r => r.column_name);

        const pkgColumnsToAdd = [
            { name: 'restricted_to_plan_ids', sql: 'ADD COLUMN IF NOT EXISTS restricted_to_plan_ids JSONB' },
            { name: 'stripe_price_id', sql: 'ADD COLUMN IF NOT EXISTS stripe_price_id TEXT' },
            { name: 'is_promotional', sql: 'ADD COLUMN IF NOT EXISTS is_promotional BOOLEAN NOT NULL DEFAULT false' },
            { name: 'is_hidden', sql: 'ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false' },
            { name: 'purchase_type', sql: "ADD COLUMN IF NOT EXISTS purchase_type TEXT DEFAULT 'standard'" },
            { name: 'valid_from', sql: 'ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP' },
            { name: 'valid_until', sql: 'ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP' },
            { name: 'promotional_expires_at', sql: 'ADD COLUMN IF NOT EXISTS promotional_expires_at TIMESTAMP' },
        ];

        for (const col of pkgColumnsToAdd) {
            if (!existingPkgColumns.includes(col.name)) {
                await client.query(`ALTER TABLE credit_packages ${col.sql}`);
                console.log(`Added column ${col.name} to credit_packages table`);
            }
        }

        // Add columns to settings
        const { rows: settingsColumns } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'settings' AND table_schema = 'public'
        `);
        const existingSettingsColumns = settingsColumns.map(r => r.column_name);

        const settingsColumnsToAdd = [
            { name: 'credits_per_standard_result', sql: 'ADD COLUMN IF NOT EXISTS credits_per_standard_result INTEGER NOT NULL DEFAULT 1' },
            { name: 'credits_per_enriched_result', sql: 'ADD COLUMN IF NOT EXISTS credits_per_enriched_result INTEGER NOT NULL DEFAULT 3' },
            { name: 'enrichment_pricing_mode', sql: "ADD COLUMN IF NOT EXISTS enrichment_pricing_mode TEXT NOT NULL DEFAULT 'fixed'" },
            { name: 'charge_for_duplicates', sql: 'ADD COLUMN IF NOT EXISTS charge_for_duplicates BOOLEAN NOT NULL DEFAULT false' },
            { name: 'duplicate_window_days', sql: 'ADD COLUMN IF NOT EXISTS duplicate_window_days INTEGER DEFAULT 30' },
        ];

        for (const col of settingsColumnsToAdd) {
            if (!existingSettingsColumns.includes(col.name)) {
                await client.query(`ALTER TABLE settings ${col.sql}`);
                console.log(`Added column ${col.name} to settings table`);
            }
        }

        // Add columns to contacts
        const { rows: contactsColumns } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'contacts' AND table_schema = 'public'
        `);
        const existingContactsColumns = contactsColumns.map(r => r.column_name);

        const contactsColumnsToAdd = [
            { name: 'place_id', sql: 'ADD COLUMN IF NOT EXISTS place_id TEXT' },
            { name: 'is_enriched', sql: 'ADD COLUMN IF NOT EXISTS is_enriched BOOLEAN NOT NULL DEFAULT false' },
            { name: 'enrichment_credits_charged', sql: 'ADD COLUMN IF NOT EXISTS enrichment_credits_charged INTEGER DEFAULT 0' },
        ];

        for (const col of contactsColumnsToAdd) {
            if (!existingContactsColumns.includes(col.name)) {
                await client.query(`ALTER TABLE contacts ${col.sql}`);
                console.log(`Added column ${col.name} to contacts table`);
            }
        }

        // Add columns to search_history
        const { rows: searchColumns } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'search_history' AND table_schema = 'public'
        `);
        const existingSearchColumns = searchColumns.map(r => r.column_name);

        const searchColumnsToAdd = [
            { name: 'standard_results_count', sql: 'ADD COLUMN IF NOT EXISTS standard_results_count INTEGER DEFAULT 0' },
            { name: 'enriched_results_count', sql: 'ADD COLUMN IF NOT EXISTS enriched_results_count INTEGER DEFAULT 0' },
            { name: 'saved_results', sql: 'ADD COLUMN IF NOT EXISTS saved_results INTEGER DEFAULT 0' },
            { name: 'requested_max_results', sql: 'ADD COLUMN IF NOT EXISTS requested_max_results INTEGER NOT NULL DEFAULT 50' },
            { name: 'request_enrichment', sql: 'ADD COLUMN IF NOT EXISTS request_enrichment BOOLEAN NOT NULL DEFAULT false' },
            { name: 'apify_actor_id', sql: 'ADD COLUMN IF NOT EXISTS apify_actor_id TEXT' },
            { name: 'apify_actor_name', sql: 'ADD COLUMN IF NOT EXISTS apify_actor_name TEXT' },
            { name: 'apify_dataset_id', sql: 'ADD COLUMN IF NOT EXISTS apify_dataset_id TEXT' },
            { name: 'apify_status_message', sql: 'ADD COLUMN IF NOT EXISTS apify_status_message TEXT' },
            { name: 'apify_usage_usd', sql: 'ADD COLUMN IF NOT EXISTS apify_usage_usd NUMERIC(10, 4)' },
            { name: 'apify_container_url', sql: 'ADD COLUMN IF NOT EXISTS apify_container_url TEXT' },
            { name: 'apify_started_at', sql: 'ADD COLUMN IF NOT EXISTS apify_started_at TIMESTAMP' },
            { name: 'apify_finished_at', sql: 'ADD COLUMN IF NOT EXISTS apify_finished_at TIMESTAMP' },
            { name: 'apify_input', sql: 'ADD COLUMN IF NOT EXISTS apify_input JSONB' },
            { name: 'error_message', sql: 'ADD COLUMN IF NOT EXISTS error_message TEXT' },
            { name: 'error_code', sql: 'ADD COLUMN IF NOT EXISTS error_code TEXT' },
            { name: 'error_details', sql: 'ADD COLUMN IF NOT EXISTS error_details JSONB' },
            { name: 'failed_at', sql: 'ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP' },
        ];

        for (const col of searchColumnsToAdd) {
            if (!existingSearchColumns.includes(col.name)) {
                await client.query(`ALTER TABLE search_history ${col.sql}`);
                console.log(`Added column ${col.name} to search_history table`);
            }
        }

        // Add columns to credit_transactions
        const { rows: txColumns } = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'credit_transactions' AND table_schema = 'public'
        `);
        const existingTxColumns = txColumns.map(r => r.column_name);

        const txColumnsToAdd = [
            { name: 'subscription_plan_id', sql: 'ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES subscription_plans(id)' },
            { name: 'stripe_payment_intent_id', sql: 'ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT' },
            { name: 'stripe_invoice_id', sql: 'ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT' },
            { name: 'money_amount', sql: 'ADD COLUMN IF NOT EXISTS money_amount DECIMAL(10, 2)' },
            { name: 'currency', sql: "ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd'" },
        ];

        for (const col of txColumnsToAdd) {
            if (!existingTxColumns.includes(col.name)) {
                await client.query(`ALTER TABLE credit_transactions ${col.sql}`);
                console.log(`Added column ${col.name} to credit_transactions table`);
            }
        }

        console.log('Billing schema migration completed successfully!');
    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    } finally {
        client.release();
    }

    await pool.end();
}

runMigrations().catch(console.error);
