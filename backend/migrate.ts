import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
    const client = await pool.connect();
    try {
        // Check if subscription_plans table exists
        const { rows } = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'subscription_plans'
        `);
        
        if (rows.length === 0) {
            console.log('Creating billing tables...');
            
            // Create enums
            await client.query(`
                DO $$ BEGIN
                    CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'incomplete', 'trialing', 'unpaid');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            
            await client.query(`
                DO $$ BEGIN
                    CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            
            await client.query(`
                DO $$ BEGIN
                    CREATE TYPE credit_transaction_type AS ENUM (
                        'monthly_grant', 'purchase', 'usage', 'refund', 'bonus', 
                        'top_up', 'rollover', 'expired', 'adjustment', 'compensation', 'promotional'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            
            await client.query(`
                DO $$ BEGIN
                    CREATE TYPE billing_event_type AS ENUM (
                        'monthly_grant', 'consumption', 'top_up', 'purchase', 
                        'refund', 'adjustment', 'rollover', 'expiration', 
                        'compensation', 'promotional'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            
            await client.query(`
                DO $$ BEGIN
                    CREATE TYPE billing_alert_type AS ENUM (
                        'credits_80', 'credits_100', 'topup_success', 'topup_failed',
                        'cap_80', 'cap_100', 'renewal_success', 'renewal_failed',
                        'payment_method_expiring'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            
            await client.query(`
                DO $$ BEGIN
                    CREATE TYPE account_risk_flag AS ENUM ('none', 'review', 'restricted', 'suspended');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
            
            // Create subscription_plans table
            await client.query(`
                CREATE TABLE IF NOT EXISTS subscription_plans (
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
            
            // Add billing columns to users table if they don't exist
            const usersColumns = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'users' AND table_schema = 'public'
            `);
            const existingColumns = usersColumns.rows.map(r => r.column_name);
            
            const columnsToAdd = [
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
            
            for (const col of columnsToAdd) {
                if (!existingColumns.includes(col.name)) {
                    await client.query(\`ALTER TABLE users \${col.sql}\`);
                    console.log(\`Added column \${col.name} to users table\`);
                }
            }
            
            // Create billing_events table
            await client.query(\`
                CREATE TABLE IF NOT EXISTS bill
