import 'dotenv/config';
import Stripe from 'stripe';
import { db } from '../db/index.js';
import { users, creditTransactions, creditPackages } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    console.warn('Warning: STRIPE_SECRET_KEY not configured. Payment functionality will not work.');
}

export const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
        typescript: true,
    })
    : null;

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

function getPaymentsWebhookSecret(): string | null {
    return process.env.STRIPE_PAYMENTS_WEBHOOK_SECRET
        || process.env.STRIPE_WEBHOOK_SECRET
        || null;
}

async function ensureStripeCustomer(
    userId: string,
    userEmail: string
): Promise<string> {
    if (!stripe) {
        throw new Error('Stripe is not configured');
    }

    const [user] = await db
        .select({
            id: users.id,
            company: users.company,
            stripeCustomerId: users.stripeCustomerId,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new Error('User not found');
    }

    if (user.stripeCustomerId) {
        return user.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
        email: userEmail,
        name: user.company?.trim() || undefined,
        metadata: {
            userId,
        },
    });

    await db
        .update(users)
        .set({
            stripeCustomerId: customer.id,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    return customer.id;
}

async function applyPurchasedCreditsFromSession(
    session: Stripe.Checkout.Session
): Promise<{ userId: string; credits: number; alreadyProcessed: boolean }> {
    const { userId, packageId, credits } = session.metadata || {};
    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!userId || !credits) {
        throw new Error('Missing metadata in session');
    }

    if (!paymentIntentId) {
        throw new Error('Missing payment intent in session');
    }

    const creditsAmount = parseInt(credits, 10);

    const [existingTransaction] = await db
        .select({
            id: creditTransactions.id,
        })
        .from(creditTransactions)
        .where(and(
            eq(creditTransactions.type, 'purchase'),
            eq(creditTransactions.stripePaymentIntentId, paymentIntentId)
        ))
        .limit(1);

    if (existingTransaction) {
        return {
            userId,
            credits: creditsAmount,
            alreadyProcessed: true,
        };
    }

    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new Error('User not found');
    }

    await db
        .update(users)
        .set({
            purchasedCredits: user.purchasedCredits + creditsAmount,
            stripeCustomerId: typeof session.customer === 'string'
                ? session.customer
                : user.stripeCustomerId,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    await db.insert(creditTransactions).values({
        userId,
        amount: creditsAmount,
        type: 'purchase',
        description: `Purchased ${creditsAmount} credits via Stripe`,
        stripePaymentIntentId: paymentIntentId,
        moneyAmount: session.amount_total !== null && session.amount_total !== undefined
            ? (session.amount_total / 100).toFixed(2)
            : null,
        currency: session.currency ?? 'usd',
        metadata: {
            source: 'stripe_checkout',
            packageId,
            checkoutSessionId: session.id,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
        },
    });

    return {
        userId,
        credits: creditsAmount,
        alreadyProcessed: false,
    };
}

// Create a Stripe Checkout session for credit purchase
export async function createCheckoutSession(
    userId: string,
    userEmail: string,
    packageId: string
): Promise<{ sessionId: string; url: string } | null> {
    if (!stripe) {
        throw new Error('Stripe is not configured');
    }

    // Get the credit package
    const [creditPackage] = await db
        .select()
        .from(creditPackages)
        .where(eq(creditPackages.id, packageId))
        .limit(1);

    if (!creditPackage || !creditPackage.isActive) {
        throw new Error('Invalid or inactive credit package');
    }

    const [user] = await db
        .select({
            id: users.id,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new Error('User not found');
    }

    const customerId = await ensureStripeCustomer(userId, userEmail);

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = creditPackage.stripePriceId
        ? {
            price: creditPackage.stripePriceId,
            quantity: 1,
        }
        : {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: creditPackage.name,
                    description: creditPackage.description || `${creditPackage.credits} credits for Xcraper`,
                },
                unit_amount: Math.round(parseFloat(creditPackage.price) * 100),
            },
            quantity: 1,
        };

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer: customerId,
        line_items: [lineItem],
        metadata: {
            userId,
            packageId,
            credits: creditPackage.credits.toString(),
        },
        success_url: `${frontendUrl}/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/billing?payment=canceled`,
    });

    return {
        sessionId: session.id,
        url: session.url || '',
    };
}

// Create a Stripe Customer Portal session
export async function createPortalSession(
    customerId: string
): Promise<{ url: string } | null> {
    if (!stripe) {
        throw new Error('Stripe is not configured');
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${frontendUrl}/billing`,
    });

    return {
        url: session.url,
    };
}

// Handle successful payment from webhook
export async function handleSuccessfulPayment(
    sessionId: string
): Promise<{ userId: string; credits: number } | null> {
    if (!stripe) {
        throw new Error('Stripe is not configured');
    }

    // Retrieve the session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
    });

    if (session.mode !== 'payment' || session.payment_status !== 'paid') {
        return null;
    }

    const result = await applyPurchasedCreditsFromSession(session);

    return {
        userId: result.userId,
        credits: result.credits,
    };
}

// Verify webhook signature
export function verifyWebhookSignature(
    payload: string | Buffer,
    signature: string
): Stripe.Event | null {
    if (!stripe) {
        throw new Error('Stripe is not configured');
    }

    const webhookSecret = getPaymentsWebhookSecret();

    if (!webhookSecret) {
        console.warn('Warning: Stripe payments webhook secret not configured.');
        return null;
    }

    try {
        const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        return event;
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return null;
    }
}

// Handle Stripe webhook events
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;

            if (session.mode === 'payment' && session.payment_status === 'paid') {
                const fullSession = await stripe!.checkout.sessions.retrieve(session.id, {
                    expand: ['payment_intent'],
                });
                const result = await applyPurchasedCreditsFromSession(fullSession);
                console.log(
                    result.alreadyProcessed
                        ? `Stripe payment already processed for session ${session.id}`
                        : `Purchased credits applied for user ${result.userId}: ${result.credits}`
                );
            }
            break;
        }

        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log('PaymentIntent succeeded:', paymentIntent.id);
            break;
        }

        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log('PaymentIntent failed:', paymentIntent.id);
            break;
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
}
