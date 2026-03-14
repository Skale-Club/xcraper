CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"address" text,
	"phone" text,
	"website" text,
	"email" text,
	"rating" numeric(2, 1),
	"review_count" integer,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"opening_hours" text,
	"image_url" text,
	"google_maps_url" text,
	"raw_data" jsonb,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"credits" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"description" text,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"search_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"location" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"apify_run_id" text,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"total_results" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" text NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"brand_name" text DEFAULT 'Xcraper' NOT NULL,
	"brand_tagline" text DEFAULT 'Extract Business Contacts from Google Maps' NOT NULL,
	"brand_description" text DEFAULT 'The most powerful Google Maps scraping tool for lead generation.' NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"seo_title" text DEFAULT 'Xcraper - Google Maps Contact Scraper' NOT NULL,
	"seo_description" text DEFAULT 'Extract business contacts, emails, phone numbers from Google Maps. Professional lead generation tool with credit-based pricing.' NOT NULL,
	"seo_keywords" text DEFAULT 'google maps scraper, lead generation, business contacts, email extractor, phone extractor' NOT NULL,
	"og_image_url" text,
	"twitter_handle" text,
	"hero_title" text DEFAULT 'Extract Business Leads from Google Maps' NOT NULL,
	"hero_subtitle" text DEFAULT 'Get phone numbers, emails, and addresses from millions of businesses worldwide.' NOT NULL,
	"hero_cta_text" text DEFAULT 'Start Free Trial' NOT NULL,
	"features_title" text DEFAULT 'Powerful Features' NOT NULL,
	"features_subtitle" text DEFAULT 'Everything you need for effective lead generation' NOT NULL,
	"pricing_title" text DEFAULT 'Simple, Transparent Pricing' NOT NULL,
	"pricing_subtitle" text DEFAULT 'Choose the plan that fits your needs' NOT NULL,
	"faq_title" text DEFAULT 'Frequently Asked Questions' NOT NULL,
	"faq_content" jsonb DEFAULT '[]'::jsonb,
	"testimonials_enabled" boolean DEFAULT true NOT NULL,
	"testimonials_content" jsonb DEFAULT '[]'::jsonb,
	"footer_text" text DEFAULT '© 2024 Xcraper. All rights reserved.' NOT NULL,
	"footer_links" jsonb DEFAULT '[]'::jsonb,
	"social_links" jsonb DEFAULT '[]'::jsonb,
	"contact_email" text,
	"contact_phone" text,
	"contact_address" text,
	"google_analytics_id" text,
	"custom_head_code" text,
	"custom_body_code" text,
	"registration_enabled" boolean DEFAULT true NOT NULL,
	"free_credits_on_signup" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"company" text,
	"phone" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_search_id_search_history_id_fk" FOREIGN KEY ("search_id") REFERENCES "search_history"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_search_id_search_history_id_fk" FOREIGN KEY ("search_id") REFERENCES "search_history"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
