CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"apify_base_run_cost_usd" numeric(10, 4) DEFAULT '0.0200' NOT NULL,
	"apify_min_run_charge_usd" numeric(10, 4) DEFAULT '0.5000' NOT NULL,
	"apify_standard_actor_id" text DEFAULT 'nwua9Gu5YrADL7ZDj' NOT NULL,
	"apify_standard_actor_name" text DEFAULT 'Google Maps Scraper (Standard)' NOT NULL,
	"apify_standard_cost_per_result_usd" numeric(10, 4) DEFAULT '0.0040' NOT NULL,
	"apify_standard_fixed_start_cost_usd" numeric(10, 4) DEFAULT '0.0070' NOT NULL,
	"apify_standard_memory_mb" integer DEFAULT 2048 NOT NULL,
	"apify_enriched_actor_id" text DEFAULT 'WnMxbsRLNbPeYL6ge' NOT NULL,
	"apify_enriched_actor_name" text DEFAULT 'Google Maps Email Extractor (Enriched)' NOT NULL,
	"apify_enriched_cost_per_result_usd" numeric(10, 4) DEFAULT '0.0090' NOT NULL,
	"apify_enriched_fixed_start_cost_usd" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"apify_enriched_memory_mb" integer DEFAULT 2048 NOT NULL,
	"default_search_language" text DEFAULT 'en' NOT NULL,
	"default_search_country_code" text DEFAULT 'us' NOT NULL,
	"public_google_maps_api_key" text,
	"public_sentry_dsn" text,
	"pwa_name" text DEFAULT 'Xcraper' NOT NULL,
	"pwa_short_name" text DEFAULT 'Xcraper' NOT NULL,
	"pwa_description" text DEFAULT 'Google Maps lead generation and contact scraping platform.' NOT NULL,
	"pwa_theme_color" text DEFAULT '#0f172a' NOT NULL,
	"pwa_background_color" text DEFAULT '#0f172a' NOT NULL,
	"pwa_icon_192_url" text,
	"pwa_icon_512_url" text,
	"pwa_maskable_icon_512_url" text,
	"pwa_apple_touch_icon_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "system_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
