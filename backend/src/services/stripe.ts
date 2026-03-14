import Stripe from 'stripe';
import { db } from '../db';
import { users, creditTransactions, creditPackages } from '../db/schema';
import { eq } from 'drizzle-orm';

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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: userEmail,
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: creditPackage.name,
                        description: creditPackage.description || `${creditPackage.credits} credits for XCraper`,
                    },
                    unit_amount: Math.round(parseFloat(creditPackage.price) * 100), // Convert to cents
                },
                quantity: 1,
            },
        ],
        metadata: {
            userId,
            packageId,
            credits: creditPackage.credits.toString(),
        },
        success_url: `${process.env.FRONTEND_URL}/credits?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/credits?payment=canceled`,
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
        return_url: `${process.env.FRONTEND_URL}/credits`,
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
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
        return null;
    }

    const { userId, credits } = session.metadata || {};

    if (!userId || !credits) {
        throw new Error('Missing metadata in session');
    }

    const creditsAmount = parseInt(credits, 10);

    // Get current user
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new Error('User not found');
    }

    // Update user credits
    await db
        .update(users)
        .set({
            credits: user.credits + creditsAmount,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

    // Create transaction record
    await db.insert(creditTransactions).values({
        userId,
        amount: creditsAmount,
        type: 'purchase',
        description: `Purchased ${creditsAmount} credits via Stripe`,
    });

    return {
        userId,
        credits: creditsAmount,
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

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.warn('Warning: STRIPE_WEBHOOK_SECRET not configured.');
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

            if (session.payment_status === 'paid') {
                const { userId, credits } = session.metadata || {};

                if (userId && credits) {
                    const creditsAmount = parseInt(credits, 10);

                    // Get current user
                    const [user] = await db
                        .select()
                        .from(users)
                        .where(eq(users.id, userId))
                        .limit(1);

                    if (user) {
                        // Update user credits
                        await db
                            .update(users)
                            .set({
                                credits: user.credits + creditsAmount,
                                updatedAt: new Date(),
                            })
                            .where(eq(users.id, userId));

                        // Create transaction record
                        await db.insert(creditTransactions).values({
                            userId,
                            amount: creditsAmount,
                            type: 'purchase',
                            description: `Purchased ${creditsAmount} credits via Stripe`,
                        });

                        console.log(`Credits added: ${creditsAmount} to user ${userId}`);
                    }
                }
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
