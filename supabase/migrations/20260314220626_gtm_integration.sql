-- Migration: Replace googleAnalyticsId, customHeadCode, customBodyCode with gtmContainerId

-- Add new column
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "gtm_container_id" text;

-- Drop old columns
ALTER TABLE "settings" DROP COLUMN IF EXISTS "google_analytics_id";
ALTER TABLE "settings" DROP COLUMN IF EXISTS "custom_head_code";
ALTER TABLE "settings" DROP COLUMN IF EXISTS "custom_body_code";
