import 'dotenv/config';
import Stripe from 'stripe';
import { db } from '../db/index.js';
import { creditPackages, subscriptionPlans } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
}

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
});

function isMissingStripeResource(error: unknown): boolean {
    return error instanceof Stripe.errors.StripeInvalidRequestError
        && error.code === 'resource_missing';
}

async function ensureProductAndPriceForPackage(packageId: string) {
    const [pkg] = await db
        .select()
        .from(creditPackages)
        .where(eq(creditPackages.id, packageId))
        .limit(1);

    if (!pkg) {
        throw new Error(`Credit package not found: ${packageId}`);
    }

    let productId: string | null = null;
    let priceId = pkg.stripePriceId;

    if (priceId) {
        try {
            const existingPrice = await stripe.prices.retrieve(priceId);
            if (existingPrice.active) {
                console.log(`Package ${pkg.name} already linked to Stripe price ${priceId}`);
                return;
            }
        } catch (error) {
            if (!isMissingStripeResource(error)) {
                throw error;
            }

            priceId = null;
        }
    }

    const product = await stripe.products.create({
        name: pkg.name,
        description: pkg.description || `${pkg.credits} credits for Xcraper`,
        metadata: {
            type: 'credit_package',
            packageId: pkg.id,
            credits: String(pkg.credits),
        },
    });
    productId = product.id;

    const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: Math.round(parseFloat(pkg.price) * 100),
        product: productId,
        metadata: {
            type: 'credit_package',
            packageId: pkg.id,
        },
    });
    priceId = price.id;

    await db
        .update(creditPackages)
        .set({
            stripePriceId: priceId,
            updatedAt: new Date(),
        })
        .where(eq(creditPackages.id, pkg.id));

    console.log(`Linked package ${pkg.name} to Stripe product ${productId} and price ${priceId}`);
}

async function ensureProductAndPriceForPlan(planId: string) {
    const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);

    if (!plan) {
        throw new Error(`Subscription plan not found: ${planId}`);
    }

    let productId = plan.stripeProductId;
    let priceId = plan.stripePriceId;

    if (productId) {
        try {
            await stripe.products.retrieve(productId);
        } catch (error) {
            if (!isMissingStripeResource(error)) {
                throw error;
            }

            productId = null;
        }
    }

    if (!productId) {
        const product = await stripe.products.create({
            name: plan.name,
            description: plan.description || `${plan.monthlyCredits} credits per ${plan.billingInterval}`,
            metadata: {
                type: 'subscription_plan',
                planId: plan.id,
                monthlyCredits: String(plan.monthlyCredits),
            },
        });
        productId = product.id;
    }

    if (priceId) {
        try {
            const existingPrice = await stripe.prices.retrieve(priceId);
            if (existingPrice.active) {
                await db
                    .update(subscriptionPlans)
                    .set({
                        stripeProductId: productId,
                        stripePriceId: priceId,
                        updatedAt: new Date(),
                    })
                    .where(eq(subscriptionPlans.id, plan.id));

                console.log(`Plan ${plan.name} already linked to Stripe product ${productId} and price ${priceId}`);
                return;
            }
        } catch (error) {
            if (!isMissingStripeResource(error)) {
                throw error;
            }

            priceId = null;
        }
    }

    if (!priceId) {
        const price = await stripe.prices.create({
            currency: 'usd',
            unit_amount: Math.round(parseFloat(plan.price) * 100),
            product: productId,
            recurring: {
                interval: plan.billingInterval === 'yearly' ? 'year' : 'month',
            },
            metadata: {
                type: 'subscription_plan',
                planId: plan.id,
            },
        });
        priceId = price.id;
    }

    await db
        .update(subscriptionPlans)
        .set({
            stripeProductId: productId,
            stripePriceId: priceId,
            updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.id, plan.id));

    console.log(`Linked plan ${plan.name} to Stripe product ${productId} and price ${priceId}`);
}

async function main() {
    const [packages, plans] = await Promise.all([
        db.select({ id: creditPackages.id }).from(creditPackages),
        db.select({ id: subscriptionPlans.id }).from(subscriptionPlans),
    ]);

    for (const pkg of packages) {
        await ensureProductAndPriceForPackage(pkg.id);
    }

    for (const plan of plans) {
        await ensureProductAndPriceForPlan(plan.id);
    }

    console.log('Stripe catalog sync complete.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
