import { pgTable, text, timestamp, integer, boolean, uuid, decimal, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Users table
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
    credits: integer('credits').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    onboardingStep: integer('onboarding_step').notNull().default(0),
    company: text('company'),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Search history table
export const searchHistory = pgTable('search_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    location: text('location').notNull(),
    status: text('status').notNull().default('pending'), // pending, running, completed, failed
    apifyRunId: text('apify_run_id'),
    creditsUsed: integer('credits_used').notNull().default(0),
    totalResults: integer('total_results').default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
});

// Contacts table (scraped results)
export const contacts = pgTable('contacts', {
    id: uuid('id').primaryKey().defaultRandom(),
    searchId: uuid('search_id').notNull().references(() => searchHistory.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: text('category'),
    address: text('address'),
    phone: text('phone'),
    website: text('website'),
    email: text('email'),
    rating: decimal('rating', { precision: 2, scale: 1 }),
    reviewCount: integer('review_count'),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    openingHours: text('opening_hours'),
    imageUrl: text('image_url'),
    googleMapsUrl: text('google_maps_url'),
    rawData: jsonb('raw_data'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Credit transactions table
export const creditTransactions = pgTable('credit_transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // positive for additions, negative for deductions
    type: text('type').notNull(), // purchase, usage, refund, bonus
    description: text('description'),
    searchId: uuid('search_id').references(() => searchHistory.id, { onDelete: 'set null' }),
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

    // Custom Code
    googleAnalyticsId: text('google_analytics_id'),
    customHeadCode: text('custom_head_code'),
    customBodyCode: text('custom_body_code'),

    // Feature Flags
    registrationEnabled: boolean('registration_enabled').notNull().default(true),
    freeCreditsOnSignup: integer('free_credits_on_signup').notNull().default(10),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Credit Packages (configurable)
export const creditPackages = pgTable('credit_packages', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    credits: integer('credits').notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    description: text('description'),
    isPopular: boolean('is_popular').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
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
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertSearchHistorySchema = createInsertSchema(searchHistory);
export const selectSearchHistorySchema = createSelectSchema(searchHistory);

export const insertContactSchema = createInsertSchema(contacts);
export const selectContactSchema = createSelectSchema(contacts);

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions);
export const selectCreditTransactionSchema = createSelectSchema(creditTransactions);

export const insertSettingsSchema = createInsertSchema(settings);
export const selectSettingsSchema = createSelectSchema(settings);

export const insertCreditPackageSchema = createInsertSchema(creditPackages);
export const selectCreditPackageSchema = createSelectSchema(creditPackages);

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type NewCreditPackage = typeof creditPackages.$inferInsert;
