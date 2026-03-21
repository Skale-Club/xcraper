import { db } from '../db/index.js';
import { users, creditTransactions, searchHistory } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logCreditEvent, logError } from '../utils/logger.js';

export interface CreditTransactionResult {
    success: boolean;
    previousBalance: number;
    newBalance: number;
    amount: number;
    transactionId?: string;
    error?: string;
}

export interface CreditDeductionParams {
    userId: string;
    amount: number;
    type: 'search' | 'contact_save' | 'usage' | 'enrichment';
    description?: string;
    searchId?: string;
    metadata?: Record<string, unknown>;
}

export interface CreditAdditionParams {
    userId: string;
    amount: number;
    type: 'purchase' | 'monthly_grant' | 'bonus' | 'refund' | 'top_up' | 'rollover' | 'compensation' | 'promotional' | 'adjustment';
    description?: string;
    stripePaymentIntentId?: string;
    stripeInvoiceId?: string;
    subscriptionPlanId?: string;
    moneyAmount?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Deduct credits atomically with pessimistic locking
 * Prevents race conditions when multiple concurrent requests try to deduct credits
 */
export async function deductCredits(params: CreditDeductionParams): Promise<CreditTransactionResult> {
    const { userId, amount, type, description, searchId, metadata } = params;

    if (amount <= 0) {
        return {
            success: false,
            previousBalance: 0,
            newBalance: 0,
            amount: 0,
            error: 'Amount must be positive'
        };
    }

    try {
        const result = await db.transaction(async (tx) => {
            // Lock the user row and get current balance
            const [user] = await tx
                .select({
                    credits: users.credits,
                    rolloverCredits: users.rolloverCredits,
                    purchasedCredits: users.purchasedCredits
                })
                .from(users)
                .where(eq(users.id, userId))
                .for('update');

            if (!user) {
                throw new Error('User not found');
            }

            const totalCredits = user.credits + user.rolloverCredits + user.purchasedCredits;

            if (totalCredits < amount) {
                throw new Error('Insufficient credits');
            }

            const previousBalance = totalCredits;
            let remainingToDeduct = amount;
            let newMainCredits = user.credits;
            let newRolloverCredits = user.rolloverCredits;
            let newPurchasedCredits = user.purchasedCredits;

            // Deduct from purchased credits first (they don't expire)
            if (remainingToDeduct > 0 && newPurchasedCredits > 0) {
                const deductFromPurchased = Math.min(remainingToDeduct, newPurchasedCredits);
                newPurchasedCredits -= deductFromPurchased;
                remainingToDeduct -= deductFromPurchased;
            }

            // Then deduct from rollover credits (they expire)
            if (remainingToDeduct > 0 && newRolloverCredits > 0) {
                const deductFromRollover = Math.min(remainingToDeduct, newRolloverCredits);
                newRolloverCredits -= deductFromRollover;
                remainingToDeduct -= deductFromRollover;
            }

            // Finally deduct from main credits
            if (remainingToDeduct > 0) {
                newMainCredits -= remainingToDeduct;
            }

            // Update user credits
            await tx
                .update(users)
                .set({
                    credits: newMainCredits,
                    rolloverCredits: newRolloverCredits,
                    purchasedCredits: newPurchasedCredits,
                    updatedAt: new Date()
                })
                .where(eq(users.id, userId));

            // Create transaction record
            const [transaction] = await tx
                .insert(creditTransactions)
                .values({
                    userId,
                    amount: -amount,
                    type: 'usage',
                    description: description || `Credit deduction: ${type}`,
                    searchId,
                    metadata: {
                        ...metadata,
                        deductionType: type,
                        previousBalance,
                        newBalance: newMainCredits + newRolloverCredits + newPurchasedCredits
                    }
                })
                .returning({ id: creditTransactions.id });

            return {
                previousBalance,
                newBalance: newMainCredits + newRolloverCredits + newPurchasedCredits,
                transactionId: transaction.id
            };
        });

        logCreditEvent('deducted', {
            userId,
            amount,
            type,
            balance: result.newBalance,
            description,
            relatedId: searchId
        });

        return {
            success: true,
            previousBalance: result.previousBalance,
            newBalance: result.newBalance,
            amount,
            transactionId: result.transactionId
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError('Credit deduction failed', error, { userId, amount, type });

        return {
            success: false,
            previousBalance: 0,
            newBalance: 0,
            amount,
            error: errorMessage
        };
    }
}

/**
 * Add credits atomically
 */
export async function addCredits(params: CreditAdditionParams): Promise<CreditTransactionResult> {
    const {
        userId,
        amount,
        type,
        description,
        stripePaymentIntentId,
        stripeInvoiceId,
        subscriptionPlanId,
        moneyAmount,
        metadata
    } = params;

    if (amount <= 0) {
        return {
            success: false,
            previousBalance: 0,
            newBalance: 0,
            amount: 0,
            error: 'Amount must be positive'
        };
    }

    try {
        const result = await db.transaction(async (tx) => {
            // Lock the user row and get current balance
            const [user] = await tx
                .select({ credits: users.credits })
                .from(users)
                .where(eq(users.id, userId))
                .for('update');

            if (!user) {
                throw new Error('User not found');
            }

            const previousBalance = user.credits;

            // Determine which credit bucket to add to
            let updateData: Record<string, unknown> = {
                updatedAt: new Date()
            };

            if (type === 'purchase' || type === 'top_up') {
                // Purchased credits go to purchasedCredits bucket
                updateData = {
                    purchasedCredits: sql`${users.purchasedCredits} + ${amount}`,
                    ...updateData
                };
            } else if (type === 'rollover') {
                // Rollover credits go to rolloverCredits bucket
                updateData = {
                    rolloverCredits: sql`${users.rolloverCredits} + ${amount}`,
                    ...updateData
                };
            } else {
                // Other credits (monthly grant, bonus, etc.) go to main credits
                updateData = {
                    credits: sql`${users.credits} + ${amount}`,
                    ...updateData
                };
            }

            // Update user credits
            await tx
                .update(users)
                .set(updateData)
                .where(eq(users.id, userId));

            // Get new balance
            const [updatedUser] = await tx
                .select({
                    credits: users.credits,
                    rolloverCredits: users.rolloverCredits,
                    purchasedCredits: users.purchasedCredits
                })
                .from(users)
                .where(eq(users.id, userId));

            const newBalance = (updatedUser?.credits || 0) +
                (updatedUser?.rolloverCredits || 0) +
                (updatedUser?.purchasedCredits || 0);

            // Create transaction record
            const [transaction] = await tx
                .insert(creditTransactions)
                .values({
                    userId,
                    amount,
                    type: mapToTransactionType(type),
                    description: description || `Credit addition: ${type}`,
                    stripePaymentIntentId,
                    stripeInvoiceId,
                    subscriptionPlanId,
                    moneyAmount,
                    metadata: {
                        ...metadata,
                        additionType: type,
                        previousBalance,
                        newBalance
                    }
                })
                .returning({ id: creditTransactions.id });

            return {
                previousBalance,
                newBalance,
                transactionId: transaction.id
            };
        });

        logCreditEvent('added', {
            userId,
            amount,
            type,
            balance: result.newBalance,
            description,
            relatedId: stripePaymentIntentId || stripeInvoiceId
        });

        return {
            success: true,
            previousBalance: result.previousBalance,
            newBalance: result.newBalance,
            amount,
            transactionId: result.transactionId
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError('Credit addition failed', error, { userId, amount, type });

        return {
            success: false,
            previousBalance: 0,
            newBalance: 0,
            amount,
            error: errorMessage
        };
    }
}

/**
 * Get user's total credit balance
 */
export async function getCreditBalance(userId: string): Promise<{
    total: number;
    main: number;
    rollover: number;
    purchased: number;
}> {
    const [user] = await db
        .select({
            credits: users.credits,
            rolloverCredits: users.rolloverCredits,
            purchasedCredits: users.purchasedCredits
        })
        .from(users)
        .where(eq(users.id, userId));

    if (!user) {
        throw new Error('User not found');
    }

    return {
        total: user.credits + user.rolloverCredits + user.purchasedCredits,
        main: user.credits,
        rollover: user.rolloverCredits,
        purchased: user.purchasedCredits
    };
}

/**
 * Check if user has enough credits
 */
export async function hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const balance = await getCreditBalance(userId);
    return balance.total >= amount;
}

/**
 * Map addition type to transaction type enum
 */
function mapToTransactionType(type: string): 'purchase' | 'monthly_grant' | 'bonus' | 'refund' | 'top_up' | 'rollover' | 'compensation' | 'promotional' | 'adjustment' {
    const typeMap: Record<string, 'purchase' | 'monthly_grant' | 'bonus' | 'refund' | 'top_up' | 'rollover' | 'compensation' | 'promotional' | 'adjustment'> = {
        purchase: 'purchase',
        monthly_grant: 'monthly_grant',
        bonus: 'bonus',
        refund: 'refund',
        top_up: 'top_up',
        rollover: 'rollover',
        compensation: 'compensation',
        promotional: 'promotional',
        adjustment: 'adjustment'
    };

    return typeMap[type] || 'adjustment';
}

export default {
    deductCredits,
    addCredits,
    getCreditBalance,
    hasEnoughCredits
};
