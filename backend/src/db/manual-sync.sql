
-- Create New Enums
DO $$ BEGIN
    CREATE TYPE "subscription_status" AS ENUM('active', 'canceled', 'past_due', 'incomplete', 'trialing', 'unpaid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "billing_interval" AS ENUM('monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "credit_transaction_type" AS ENUM('monthly_grant', 'purchase', 'usage', 'refund', 'bonus', 'top_up', 'rollover', 'expired', 'adjustment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"billing_interval" "billing_interval" DEFAULT 'monthly' NOT NULL,
	"monthly_credits" integer DEFAULT 500 NOT NULL,
	"stripe_price_id" text,
	"stripe_product_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"allow_auto_top_up" boolean DEFAULT true NOT NULL,
	"allow_manual_purchase" boolean DEFAULT true NOT NULL,
	"allow_overage" boolean DEFAULT true NOT NULL,
	"default_top_up_credits" integer DEFAULT 250,
	"default_top_up_price" numeric(10, 2) DEFAULT '5.90',
	"default_monthly_top_up_cap" numeric(10, 2) DEFAULT '20.00',
	"top_up_threshold" integer DEFAULT 50,
	"allow_rollover" boolean DEFAULT false NOT NULL,
	"max_rollover_credits" integer,
	"rollover_expiration_days" integer,
	"trial_days" integer,
	"trial_credits" integer,
	"internal_notes" text,
	"estimated_cost_per_credit" numeric(10, 6),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Update users table with new columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rollover_credits" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "purchased_credits" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_plan_id" uuid;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" "subscription_status" DEFAULT 'incomplete';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_cycle_start" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_cycle_end" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthly_credits_used" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auto_top_up_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthly_top_up_cap" numeric(10, 2) DEFAULT '20.00';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_month_top_up_spend" numeric(10, 2) DEFAULT '0.00';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "top_up_threshold" integer DEFAULT 50;

-- Add foreign key to users
DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update search_history status column to support enum (or just keep it as text for now but ensure it exists)
-- In the schema it's now an enum-like string.
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "standard_results_count" integer DEFAULT 0;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "enriched_results_count" integer DEFAULT 0;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "saved_results" integer DEFAULT 0;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "requested_max_results" integer DEFAULT 50 NOT NULL;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "request_enrichment" boolean DEFAULT false NOT NULL;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_actor_id" text;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_actor_name" text;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_dataset_id" text;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_status_message" text;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_usage_usd" numeric(10, 4);
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_container_url" text;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_started_at" timestamp;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_finished_at" timestamp;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "apify_input" jsonb;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "error_code" text;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "error_details" jsonb;
ALTER TABLE "search_history" ADD COLUMN IF NOT EXISTS "failed_at" timestamp;

-- Update contacts table
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "place_id" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "is_enriched" boolean DEFAULT false NOT NULL;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "enrichment_credits_charged" integer DEFAULT 0;

-- Update credit_transactions table
-- Change type to use enum if possible, but it's hard to alter column type without casting.
-- Let's just add new columns for now.
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "subscription_plan_id" uuid;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "stripe_invoice_id" text;
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "money_amount" numeric(10, 2);
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'usd';
ALTER TABLE "credit_transactions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

DO $$ BEGIN
    ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update credit_packages (manual purchase) table
-- This was already created but we added restricted_to_plan_ids etc.
ALTER TABLE "credit_packages" ADD COLUMN IF NOT EXISTS "restricted_to_plan_ids" jsonb;
ALTER TABLE "credit_packages" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;
ALTER TABLE "credit_packages" ADD COLUMN IF NOT EXISTS "is_promotional" boolean DEFAULT false NOT NULL;
ALTER TABLE "credit_packages" ADD COLUMN IF NOT EXISTS "promotional_expires_at" timestamp;

-- Update settings with new rules
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "credits_per_standard_result" integer DEFAULT 1 NOT NULL;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "credits_per_enriched_result" integer DEFAULT 3 NOT NULL;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "enrichment_pricing_mode" text DEFAULT 'fixed' NOT NULL;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "charge_for_duplicates" boolean DEFAULT false NOT NULL;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "duplicate_window_days" integer DEFAULT 30;

-- Re-enable RLS on new tables
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_summary" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for subscription_plans
DROP POLICY IF EXISTS "Public can view active plans" ON "subscription_plans";
DROP POLICY IF EXISTS "Admins can manage all plans" ON "subscription_plans";
CREATE POLICY "Public can view active plans" ON "subscription_plans" FOR SELECT USING (is_active = true AND is_public = true);
CREATE POLICY "Admins can manage all plans" ON "subscription_plans" FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Add RLS policies for billing tables
DROP POLICY IF EXISTS "Users can view own billing events" ON "billing_events";
DROP POLICY IF EXISTS "Admins can manage all billing events" ON "billing_events";
DROP POLICY IF EXISTS "Users can view own billing alerts" ON "billing_alerts";
DROP POLICY IF EXISTS "Admins can manage all billing alerts" ON "billing_alerts";
DROP POLICY IF EXISTS "Users can view own usage summary" ON "usage_summary";
DROP POLICY IF EXISTS "Admins can manage all usage summary" ON "usage_summary";

CREATE POLICY "Users can view own billing events" ON "billing_events" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all billing events" ON "billing_events" FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own billing alerts" ON "billing_alerts" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all billing alerts" ON "billing_alerts" FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own usage summary" ON "usage_summary" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all usage summary" ON "usage_summary" FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
