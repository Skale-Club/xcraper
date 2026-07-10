import 'dotenv/config';
import Stripe from 'stripe';
import { db } from '../db/index.js';
import { users, creditTransactions, creditPackages, billingEvents } from '../db/schema.js';
import { and, eq, inArray, sql } from 'drizzle-orm';

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

    // The whole grant runs in a single transaction that locks the user row, so a
    // duplicate Stripe delivery (webhook retry) racing the /verify endpoint cannot
    // both pass the idempotency check and grant credits twice — the second caller
    // blocks on the lock, then sees the existing transaction and no-ops.
    return await db.transaction(async (tx) => {
        const [user] = await tx
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .for('update')
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        const [existingTransaction] = await tx
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

        await tx
            .update(users)
            .set({
                purchasedCredits: sql`${users.purchasedCredits} + ${creditsAmount}`,
                stripeCustomerId: typeof session.customer === 'string'
                    ? session.customer
                    : user.stripeCustomerId,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        await tx.insert(creditTransactions).values({
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
    });
}

/**
 * Reverse the credits granted for a refunded payment. Pro-rated against the
 * cumulative refunded amount and idempotent per payment intent (only the first
 * charge.refunded delivery applies; later partial refunds on the same charge
 * are not re-processed). Buckets drain purchased → rollover → monthly, mirroring
 * where paid grants land, and never go negative — if the user already spent the
 * credits, the reversal clamps to what remains.
 */
async function applyRefundForPaymentIntent(
    paymentIntentId: string,
    amountRefunded: number | null,
    amountTotal: number | null,
    currency: string | null
): Promise<{ processed: boolean; userId?: string; creditsReversed?: number; reason?: string }> {
    return await db.transaction(async (tx) => {
        const [grant] = await tx
            .select()
            .from(creditTransactions)
            .where(and(
                inArray(creditTransactions.type, ['purchase', 'top_up']),
                eq(creditTransactions.stripePaymentIntentId, paymentIntentId)
            ))
            .limit(1);

        if (!grant) {
            return { processed: false, reason: 'no_grant_for_payment_intent' };
        }

        const [user] = await tx
            .select()
            .from(users)
            .where(eq(users.id, grant.userId))
            .for('update')
            .limit(1);

        if (!user) {
            return { processed: false, reason: 'user_not_found' };
        }

        const [existingRefund] = await tx
            .select({ id: creditTransactions.id })
            .from(creditTransactions)
            .where(and(
                eq(creditTransactions.type, 'refund'),
                eq(creditTransactions.stripePaymentIntentId, paymentIntentId)
            ))
            .limit(1);

        if (existingRefund) {
            return { processed: false, reason: 'already_processed' };
        }

        const refundFraction = amountRefunded && amountTotal
            ? Math.min(1, amountRefunded / amountTotal)
            : 1;
        const creditsToReverse = Math.round(grant.amount * refundFraction);

        if (creditsToReverse <= 0) {
            return { processed: false, reason: 'nothing_to_reverse' };
        }

        let remaining = creditsToReverse;
        const fromPurchased = Math.min(user.purchasedCredits, remaining);
        remaining -= fromPurchased;
        const fromRollover = Math.min(user.rolloverCredits, remaining);
        remaining -= fromRollover;
        const fromMonthly = Math.min(user.credits, remaining);
        remaining -= fromMonthly;
        const creditsReversed = fromPurchased + fromRollover + fromMonthly;

        await tx
            .update(users)
            .set({
                purchasedCredits: user.purchasedCredits - fromPurchased,
                rolloverCredits: user.rolloverCredits - fromRollover,
                credits: user.credits - fromMonthly,
                updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));

        const moneyRefunded = amountRefunded !== null && amountRefunded !== undefined
            ? (amountRefunded / 100).toFixed(2)
            : null;

        await tx.insert(creditTransactions).values({
            userId: user.id,
            amount: -creditsReversed,
            type: 'refund',
            description: `Stripe refund: reversed ${creditsReversed} of ${grant.amount} credits`,
            stripePaymentIntentId: paymentIntentId,
            moneyAmount: moneyRefunded,
            currency: currency ?? 'usd',
            metadata: {
                source: 'stripe_charge_refunded',
                originalTransactionId: grant.id,
                creditsGranted: grant.amount,
                creditsRequested: creditsToReverse,
            },
        });

        await tx.insert(billingEvents).values({
            userId: user.id,
            eventType: 'refund',
            creditDelta: -creditsReversed,
            moneyAmount: moneyRefunded,
            currency: currency ?? 'usd',
            stripePaymentIntentId: paymentIntentId,
            metadata: {
                source: 'stripe_charge_refunded',
                originalTransactionId: grant.id,
            },
        });

        return { processed: true, userId: user.id, creditsReversed };
    });
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

        case 'charge.refunded': {
            const charge = event.data.object as Stripe.Charge;
            const paymentIntentId = typeof charge.payment_intent === 'string'
                ? charge.payment_intent
                : charge.payment_intent?.id;

            if (!paymentIntentId) {
                console.warn(`charge.refunded ${charge.id} has no payment intent, skipping`);
                break;
            }

            const result = await applyRefundForPaymentIntent(
                paymentIntentId,
                charge.amount_refunded ?? null,
                charge.amount ?? null,
                charge.currency ?? null
            );

            console.log(
                result.processed
                    ? `Refund reversed ${result.creditsReversed} credits for user ${result.userId} (pi ${paymentIntentId})`
                    : `Refund for pi ${paymentIntentId} not applied: ${result.reason}`
            );
            break;
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
}
