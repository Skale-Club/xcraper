import { pgTable, text, timestamp, integer, boolean, uuid, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Subscription status enum
export const subscriptionStatusEnum = pgEnum('subscription_status', [
    'active',
    'canceled',
    'past_due',
    'incomplete',
    'trialing',
    'unpaid'
]);

// Billing interval enum
export const billingIntervalEnum = pgEnum('billing_interval', [
    'monthly',
    'yearly'
]);

// Credit transaction type enum
export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
    'monthly_grant',      // Credits from subscription
    'purchase',           // One-time purchase
    'usage',              // Credit consumption
    'refund',             // Refund
    'bonus',              // Admin granted bonus
    'top_up',            // Auto top-up
    'rollover',          // Rolled over from previous cycle
    'expired',           // Expired rollover credits
    'adjustment',        // Manual admin adjustment
    'compensation',      // Compensation credits
    'promotional'        // Promotional credits
]);

// Billing event type enum
export const billingEventTypeEnum = pgEnum('billing_event_type', [
    'monthly_grant',
    'consumption',
    'top_up',
    'purchase',
    'refund',
    'adjustment',
    'rollover',
    'expiration',
    'compensation',
    'promotional'
]);

// Billing alert type enum
export const billingAlertTypeEnum = pgEnum('billing_alert_type', [
    'credits_80',
    'credits_100',
    'topup_success',
    'topup_failed',
    'cap_80',
    'cap_100',
    'renewal_success',
    'renewal_failed',
    'payment_method_expiring'
]);

// Account risk flag enum
export const accountRiskFlagEnum = pgEnum('account_risk_flag', [
    'none',
    'review',
    'restricted',
    'suspended'
]);

// Subscription Plans table
export const subscriptionPlans = pgTable('subscription_plans', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Plan identification
    name: text('name').notNull(),                          // e.g., "Starter"
    description: text('description'),
    displayOrder: integer('display_order').notNull().default(0),

    // Pricing
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),  // e.g., "9.90"
    billingInterval: billingIntervalEnum('billing_interval').notNull().default('monthly'),

    // Credit allocation
    monthlyCredits: integer('monthly_credits').notNull().default(500),  // Credits per month

    // Stripe integration
    stripePriceId: text('stripe_price_id'),
    stripeProductId: text('stripe_product_id'),

    // Feature flags
    isActive: boolean('is_active').notNull().default(true),
    isPublic: boolean('is_public').notNull().default(true),   // Visible on pricing page
    allowAutoTopUp: boolean('allow_auto_top_up').notNull().default(true),
    allowManualPurchase: boolean('allow_manual_purchase').notNull().default(true),
    allowOverage: boolean('allow_overage').notNull().default(true),

    // Auto top-up defaults
    defaultTopUpCredits: integer('default_top_up_credits').default(250),
    defaultTopUpPrice: decimal('default_top_up_price', { precision: 10, scale: 2 }).default('5.90'),
    defaultMonthlyTopUpCap: decimal('default_monthly_top_up_cap', { precision: 10, scale: 2 }).default('20.00'),
    topUpThreshold: integer('top_up_threshold').default(50),  // Trigger at X credits remaining

    // Rollover settings
    allowRollover: boolean('allow_rollover').notNull().default(false),
    maxRolloverCredits: integer('max_rollover_credits'),
    rolloverExpirationDays: integer('rollover_expiration_days'),  // Days before rollover expires

    // Trial settings
    trialDays: integer('trial_days'),
    trialCredits: integer('trial_credits'),

    // Internal notes
    internalNotes: text('internal_notes'),
    estimatedCostPerCredit: decimal('estimated_cost_per_credit', { precision: 10, scale: 6 }),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Users table
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),

    // Credit balance
    credits: integer('credits').notNull().default(0),
    rolloverCredits: integer('rollover_credits').notNull().default(0),
    purchasedCredits: integer('purchased_credits').notNull().default(0),

    // Subscription
    subscriptionPlanId: uuid('subscription_plan_id').references(() => subscriptionPlans.id),
    subscriptionStatus: subscriptionStatusEnum('subscription_status').default('incomplete'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),

    // Billing cycle
    billingCycleStart: timestamp('billing_cycle_start'),
    billingCycleEnd: timestamp('billing_cycle_end'),
    monthlyCreditsUsed: integer('monthly_credits_used').notNull().default(0),
    topUpsThisCycle: integer('top_ups_this_cycle').notNull().default(0),

    // Auto top-up settings
    autoTopUpEnabled: boolean('auto_top_up_enabled').notNull().default(true),
    monthlyTopUpCap: decimal('monthly_top_up_cap', { precision: 10, scale: 2 }).default('20.00'),
    currentMonthTopUpSpend: decimal('current_month_top_up_spend', { precision: 10, scale: 2 }).default('0.00'),
    topUpThreshold: integer('top_up_threshold').default(50),
    topUpBlockCredits: integer('top_up_block_credits').default(250),
    topUpBlockPrice: decimal('top_up_block_price', { precision: 10, scale: 2 }).default('5.90'),

    // Spending cap override (admin can set per-user)
    capOverride: decimal('cap_override', { precision: 10, scale: 2 }),
    hardUsageStop: boolean('hard_usage_stop').notNull().default(false),

    // Account status
    isActive: boolean('is_active').notNull().default(true),
    accountRiskFlag: accountRiskFlagEnum('account_risk_flag').notNull().default('none'),
    supportNotes: text('support_notes'),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    onboardingStep: integer('onboarding_step').notNull().default(0),

    // Profile
    company: text('company'),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Search history table
export const searchHistory = pgTable('search_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    location: text('location').notNull(),
    requestedMaxResults: integer('requested_max_results').notNull().default(50),
    requestEnrichment: boolean('request_enrichment').notNull().default(false),
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'paused'] }).notNull().default('pending'),
    apifyRunId: text('apify_run_id'),
    apifyActorId: text('apify_actor_id'),
    apifyActorName: text('apify_actor_name'),
    apifyDatasetId: text('apify_dataset_id'),
    apifyStatusMessage: text('apify_status_message'),
    apifyUsageUsd: decimal('apify_usage_usd', { precision: 10, scale: 4 }),
    apifyContainerUrl: text('apify_container_url'),
    apifyStartedAt: timestamp('apify_started_at'),
    apifyFinishedAt: timestamp('apify_finished_at'),
    apifyInput: jsonb('apify_input').$type<Record<string, unknown>>(),

    // Error tracking
    errorMessage: text('error_message'),                    // User-friendly error message
    errorCode: text('error_code'),                          // Error code (e.g., 'APIFY_TIMEOUT', 'INSUFFICIENT_CREDITS')
    errorDetails: jsonb('error_details').$type<{
        type?: string;
        message?: string;
        stack?: string;
        apifyError?: any;
        statusCode?: number;
        timestamp?: string;
    }>(),
    failedAt: timestamp('failed_at'),

    // Credit tracking
    creditsUsed: integer('credits_used').notNull().default(0),
    standardResultsCount: integer('standard_results_count').default(0),
    enrichedResultsCount: integer('enriched_results_count').default(0),

    // Results
    totalResults: integer('total_results').default(0),
    savedResults: integer('saved_results').default(0),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
});

// Contacts table (scraped results)
export const contacts = pgTable('contacts', {
    id: uuid('id').primaryKey().defaultRandom(),
    searchId: uuid('search_id').notNull().references(() => searchHistory.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Business info
    title: text('title').notNull(),
    category: text('category'),
    address: text('address'),
    phone: text('phone'),
    website: text('website'),
    email: text('email'),

    // Ratings and location
    rating: decimal('rating', { precision: 2, scale: 1 }),
    reviewCount: integer('review_count'),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),

    // Additional data
    openingHours: text('opening_hours'),
    imageUrl: text('image_url'),
    googleMapsUrl: text('google_maps_url'),
    placeId: text('place_id'),  // Google Place ID for deduplication
    rawData: jsonb('raw_data'),

    // Social media (extracted from rawData for easy access)
    facebook: text('facebook'),
    instagram: text('instagram'),
    twitter: text('twitter'),
    linkedin: text('linkedin'),
    youtube: text('youtube'),
    tiktok: text('tiktok'),
    pinterest: text('pinterest'),

    // Enrichment tracking
    isEnriched: boolean('is_enriched').notNull().default(false),
    enrichmentCreditsCharged: integer('enrichment_credits_charged').default(0),

    // User actions
    isFavorite: boolean('is_favorite').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Credit transactions table (enhanced ledger)
export const creditTransactions = pgTable('credit_transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Transaction details
    amount: integer('amount').notNull(),  // Positive = add, Negative = deduct
    type: creditTransactionTypeEnum('type').notNull(),
    description: text('description'),

    // Related objects
    searchId: uuid('search_id').references(() => searchHistory.id, { onDelete: 'set null' }),
    subscriptionPlanId: uuid('subscription_plan_id').references(() => subscriptionPlans.id),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeInvoiceId: text('stripe_invoice_id'),

    // Money tracking (for purchases/top-ups)
    moneyAmount: decimal('money_amount', { precision: 10, scale: 2 }),
    currency: text('currency').default('usd'),

    // Metadata
    metadata: jsonb('metadata').$type<{
        source?: string;
        adminId?: string;
        reason?: string;
        billingCycleStart?: string;
        billingCycleEnd?: string;
        standardResults?: number;
        enrichedResults?: number;
        [key: string]: unknown;
    }>(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Credit packages (for manual purchase)
export const creditPackages = pgTable('credit_packages', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    credits: integer('credits').notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    description: text('description'),

    // Display settings
    isPopular: boolean('is_popular').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),

    // Restrictions
    restrictedToPlanIds: jsonb('restricted_to_plan_ids').$type<string[]>(),

    // Stripe integration
    stripePriceId: text('stripe_price_id'),

    // Promotion
    isPromotional: boolean('is_promotional').notNull().default(false),
    isHidden: boolean('is_hidden').notNull().default(false),
    purchaseType: text('purchase_type', { enum: ['standard', 'promo', 'compensation', 'admin_only'] }).default('standard'),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    promotionalExpiresAt: timestamp('promotional_expires_at'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Billing events table (immutable ledger)
export const billingEvents = pgTable('billing_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Event details
    eventType: billingEventTypeEnum('event_type').notNull(),
    creditDelta: integer('credit_delta').notNull(),
    moneyAmount: decimal('money_amount', { precision: 10, scale: 2 }),
    currency: text('currency').default('usd'),

    // Related objects
    searchId: uuid('search_id').references(() => searchHistory.id, { onDelete: 'set null' }),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeInvoiceId: text('stripe_invoice_id'),
    subscriptionPlanId: uuid('subscription_plan_id').references(() => subscriptionPlans.id),

    // Metadata
    metadata: jsonb('metadata').$type<{
        source?: string;
        adminId?: string;
        reason?: string;
        billingCycleStart?: string;
        billingCycleEnd?: string;
        standardResults?: number;
        enrichedResults?: number;
        topUpBlockCredits?: number;
        topUpBlockPrice?: string;
        [key: string]: unknown;
    }>(),

    // Admin action tracking
    adminId: uuid('admin_id'),
    reason: text('reason'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Billing alerts table (track sent alerts)
export const billingAlerts = pgTable('billing_alerts', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    alertType: billingAlertTypeEnum('alert_type').notNull(),
    sentAt: timestamp('sent_at').notNull().defaultNow(),

    // Alert details
    metadata: jsonb('metadata').$type<{
        creditsRemaining?: number;
        capPercentage?: number;
        topUpAmount?: string;
        errorMessage?: string;
        [key: string]: unknown;
    }>(),
});

// Usage summary table (aggregated for reporting)
export const usageSummary = pgTable('usage_summary', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Period
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),

    // Usage stats
    jobsSubmitted: integer('jobs_submitted').notNull().default(0),
    jobsCompleted: integer('jobs_completed').notNull().default(0),
    jobsFailed: integer('jobs_failed').notNull().default(0),
    standardResults: integer('standard_results').notNull().default(0),
    enrichedResults: integer('enriched_results').notNull().default(0),
    creditsConsumed: integer('credits_consumed').notNull().default(0),

    // Revenue stats
    topUpCredits: integer('top_up_credits').notNull().default(0),
    topUpRevenue: decimal('top_up_revenue', { precision: 10, scale: 2 }).default('0.00'),
    purchaseCredits: integer('purchase_credits').notNull().default(0),
    purchaseRevenue: decimal('purchase_revenue', { precision: 10, scale: 2 }).default('0.00'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Sessions table (for connect-pg-simple)
export const sessions = pgTable('session', {
    sid: text('sid').primaryKey(),
    sess: text('sess').notNull(),
    expire: timestamp('expire').notNull(),
});

// Settings table (for configurable content - SEO, landing page, etc.)
export const settings = pgTable('settings', {
    id: text('id').primaryKey().default('default'),

    // Branding
    brandName: text('brand_name').notNull().default('Xcraper'),
    brandTagline: text('brand_tagline').notNull().default('Extract Business Contacts from Google Maps'),
    brandDescription: text('brand_description').notNull().default('The most powerful Google Maps scraping tool for lead generation.'),
    logoUrl: text('logo_url'),
    faviconUrl: text('favicon_url'),

    // SEO Settings
    seoTitle: text('seo_title').notNull().default('Xcraper - Google Maps Contact Scraper'),
    seoDescription: text('seo_description').notNull().default('Extract business contacts, emails, phone numbers from Google Maps. Professional lead generation tool with credit-based pricing.'),
    seoKeywords: text('seo_keywords').notNull().default('google maps scraper, lead generation, business contacts, email extractor, phone extractor'),
    ogImageUrl: text('og_image_url'),
    twitterHandle: text('twitter_handle'),

    // Landing Page Content
    heroTitle: text('hero_title').notNull().default('Extract Business Leads from Google Maps'),
    heroSubtitle: text('hero_subtitle').notNull().default('Get phone numbers, emails, and addresses from millions of businesses worldwide.'),
    heroCtaText: text('hero_cta_text').notNull().default('Start Free Trial'),

    featuresTitle: text('features_title').notNull().default('Powerful Features'),
    featuresSubtitle: text('features_subtitle').notNull().default('Everything you need for effective lead generation'),

    pricingTitle: text('pricing_title').notNull().default('Simple, Transparent Pricing'),
    pricingSubtitle: text('pricing_subtitle').notNull().default('Choose the plan that fits your needs'),

    faqTitle: text('faq_title').notNull().default('Frequently Asked Questions'),
    faqContent: jsonb('faq_content').$type<{
        question: string;
        answer: string;
    }[]>().default([]),

    testimonialsEnabled: boolean('testimonials_enabled').notNull().default(true),
    testimonialsContent: jsonb('testimonials_content').$type<{
        name: string;
        role: string;
        company: string;
        content: string;
        avatar?: string;
    }[]>().default([]),

    // Footer
    footerText: text('footer_text').notNull().default('© 2024 Xcraper. All rights reserved.'),
    footerLinks: jsonb('footer_links').$type<{
        label: string;
        url: string;
    }[]>().default([]),

    // Social Links
    socialLinks: jsonb('social_links').$type<{
        platform: string;
        url: string;
    }[]>().default([]),

    // Contact Info
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    contactAddress: text('contact_address'),

    // Google Tag Manager
    gtmContainerId: text('gtm_container_id'),

    // Feature Flags
    registrationEnabled: boolean('registration_enabled').notNull().default(true),
    freeCreditsOnSignup: integer('free_credits_on_signup').notNull().default(10),

    // Credit Rules (Admin configurable)
    creditsPerStandardResult: integer('credits_per_standard_result').notNull().default(1),
    creditsPerEnrichedResult: integer('credits_per_enriched_result').notNull().default(3),
    enrichmentPricingMode: text('enrichment_pricing_mode', { enum: ['fixed', 'base_plus_enrichment'] }).notNull().default('fixed'),
    chargeForDuplicates: boolean('charge_for_duplicates').notNull().default(false),
    duplicateWindowDays: integer('duplicate_window_days').default(30),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
    users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    subscriptionPlan: one(subscriptionPlans, {
        fields: [users.subscriptionPlanId],
        references: [subscriptionPlans.id],
    }),
    searchHistory: many(searchHistory),
    contacts: many(contacts),
    creditTransactions: many(creditTransactions),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one, many }) => ({
    user: one(users, {
        fields: [searchHistory.userId],
        references: [users.id],
    }),
    contacts: many(contacts),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
    search: one(searchHistory, {
        fields: [contacts.searchId],
        references: [searchHistory.id],
    }),
    user: one(users, {
        fields: [contacts.userId],
        references: [users.id],
    }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
    user: one(users, {
        fields: [creditTransactions.userId],
        references: [users.id],
    }),
    search: one(searchHistory, {
        fields: [creditTransactions.searchId],
        references: [searchHistory.id],
    }),
    subscriptionPlan: one(subscriptionPlans, {
        fields: [creditTransactions.subscriptionPlanId],
        references: [subscriptionPlans.id],
    }),
}));

export const billingEventsRelations = relations(billingEvents, ({ one }) => ({
    user: one(users, {
        fields: [billingEvents.userId],
        references: [users.id],
    }),
    search: one(searchHistory, {
        fields: [billingEvents.searchId],
        references: [searchHistory.id],
    }),
    subscriptionPlan: one(subscriptionPlans, {
        fields: [billingEvents.subscriptionPlanId],
        references: [subscriptionPlans.id],
    }),
}));

export const billingAlertsRelations = relations(billingAlerts, ({ one }) => ({
    user: one(users, {
        fields: [billingAlerts.userId],
        references: [users.id],
    }),
}));

export const usageSummaryRelations = relations(usageSummary, ({ one }) => ({
    user: one(users, {
        fields: [usageSummary.userId],
        references: [users.id],
    }),
}));

// Zod schemas for validation
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const selectSubscriptionPlanSchema = createSelectSchema(subscriptionPlans);

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertSearchHistorySchema = createInsertSchema(searchHistory);
export const selectSearchHistorySchema = createSelectSchema(searchHistory);

export const insertContactSchema = createInsertSchema(contacts);
export const selectContactSchema = createSelectSchema(contacts);

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions);
export const selectCreditTransactionSchema = createSelectSchema(creditTransactions);

export const insertCreditPackageSchema = createInsertSchema(creditPackages);
export const selectCreditPackageSchema = createSelectSchema(creditPackages);

export const insertSettingsSchema = createInsertSchema(settings);
export const selectSettingsSchema = createSelectSchema(settings);

export const insertBillingEventSchema = createInsertSchema(billingEvents);
export const selectBillingEventSchema = createSelectSchema(billingEvents);

export const insertBillingAlertSchema = createInsertSchema(billingAlerts);
export const selectBillingAlertSchema = createSelectSchema(billingAlerts);

export const insertUsageSummarySchema = createInsertSchema(usageSummary);
export const selectUsageSummarySchema = createSelectSchema(usageSummary);

// Types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type NewCreditPackage = typeof creditPackages.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type NewBillingEvent = typeof billingEvents.$inferInsert;
export type BillingAlert = typeof billingAlerts.$inferSelect;
export type NewBillingAlert = typeof billingAlerts.$inferInsert;
export type UsageSummary = typeof usageSummary.$inferSelect;
export type NewUsageSummary = typeof usageSummary.$inferInsert;
