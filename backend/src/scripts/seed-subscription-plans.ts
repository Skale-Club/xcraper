import 'dotenv/config';
import { db } from '../db/index.js';
import { subscriptionPlans, creditPackages, settings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function seedSubscriptionPlans() {
    console.log('Seeding subscription plans and billing configuration...');

    try {
        // Check if Starter plan already exists
        const existingPlans = await db.select().from(subscriptionPlans);

        if (existingPlans.length === 0) {
            // Create the Starter plan as specified in the billing spec
            const [starterPlan] = await db.insert(subscriptionPlans).values({
                name: 'Starter',
                description: 'Perfect for individuals and small businesses getting started with lead generation.',
                price: '9.90',
                billingInterval: 'monthly',
                monthlyCredits: 500,
                displayOrder: 1,
                isActive: true,
                isPublic: true,
                allowAutoTopUp: true,
                allowManualPurchase: true,
                allowOverage: true,
                defaultTopUpCredits: 250,
                defaultTopUpPrice: '5.90',
                defaultMonthlyTopUpCap: '20.00',
                topUpThreshold: 50,
                allowRollover: false,
            }).returning();

            console.log('Created Starter plan:', starterPlan.id);
        } else {
            console.log('Starter plan already exists, skipping creation');
        }

        // Create credit packages for manual purchase
        const existingPackages = await db.select().from(creditPackages);

        if (existingPackages.length === 0) {
            // 250 credits for $5.90
            await db.insert(creditPackages).values({
                name: 'Starter Pack',
                credits: 250,
                price: '5.90',
                description: '250 credits for when you need a little extra.',
                isPopular: false,
                isActive: true,
                sortOrder: 1,
            });

            // 500 credits for $10.90
            await db.insert(creditPackages).values({
                name: 'Value Pack',
                credits: 500,
                price: '10.90',
                description: '500 credits - best value for regular users.',
                isPopular: true,
                isActive: true,
                sortOrder: 2,
            });

            // 1000 credits for $19.90
            await db.insert(creditPackages).values({
                name: 'Power Pack',
                credits: 1000,
                price: '19.90',
                description: '1000 credits - best deal for heavy users.',
                isPopular: false,
                isActive: true,
                sortOrder: 3,
            });

            console.log('Created credit packages');
        } else {
            console.log('Credit packages already exist, skipping creation');
        }

        // Update settings with credit rules
        const [existingSettings] = await db.select().from(settings).limit(1);

        if (existingSettings) {
            await db.update(settings)
                .set({
                    creditsPerStandardResult: 1,
                    creditsPerEnrichedResult: 3,
                    enrichmentPricingMode: 'fixed',
                    chargeForDuplicates: false,
                    duplicateWindowDays: 30,
                    updatedAt: new Date(),
                })
                .where(eq(settings.id, 'default'));

            console.log('Updated credit rules in settings');
        } else {
            console.log('Settings not found, will be created by main seed script');
        }

        console.log('Seed completed successfully!');
    } catch (error) {
        console.error('Error seeding subscription plans:', error);
        process.exit(1);
    }
}

seedSubscriptionPlans();
