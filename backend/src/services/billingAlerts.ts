import { db } from '../db';
import { users, billingAlerts, subscriptionPlans } from '../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

export type AlertType = 
    | 'credits_80'
    | 'credits_100'
    | 'topup_success'
    | 'topup_failed'
    | 'cap_80'
    | 'cap_100'
    | 'renewal_success'
    | 'renewal_failed'
    | 'payment_method_expiring';

export interface AlertConfig {
    enabled: boolean;
    channels: ('email' | 'in_app')[];
}

class BillingAlertService {
    private alertConfigs: Record<AlertType, AlertConfig> = {
        credits_80: { enabled: true, channels: ['email', 'in_app'] },
        credits_100: { enabled: true, channels: ['email', 'in_app'] },
        topup_success: { enabled: true, channels: ['email', 'in_app'] },
        topup_failed: { enabled: true, channels: ['email', 'in_app'] },
        cap_80: { enabled: true, channels: ['email', 'in_app'] },
        cap_100: { enabled: true, channels: ['email', 'in_app'] },
        renewal_success: { enabled: true, channels: ['email'] },
        renewal_failed: { enabled: true, channels: ['email', 'in_app'] },
        payment_method_expiring: { enabled: true, channels: ['email'] },
    };

    async checkCreditAlerts(userId: string): Promise<{
        sent80: boolean;
        sent100: boolean;
    }> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return { sent80: false, sent100: false };
        }

        let planMonthlyCredits = 500;
        if (user.subscriptionPlanId) {
            const [plan] = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .limit(1);
            if (plan) {
                planMonthlyCredits = plan.monthlyCredits;
            }
        }

        const totalCredits = user.credits + user.rolloverCredits + user.purchasedCredits;
        const percentageRemaining = planMonthlyCredits > 0 
            ? (totalCredits / planMonthlyCredits) * 100 
            : 100;

        let sent80 = false;
        let sent100 = false;

        if (percentageRemaining <= 20 && percentageRemaining > 0) {
            if (!(await this.hasSentAlert(userId, 'credits_80', this.getCurrentPeriod()))) {
                await this.sendCredits80Alert(userId, totalCredits);
                sent80 = true;
            }
        }

        if (totalCredits === 0) {
            if (!(await this.hasSentAlert(userId, 'credits_100', this.getCurrentPeriod()))) {
                await this.sendCredits100Alert(userId);
                sent100 = true;
            }
        }

        return { sent80, sent100 };
    }

    async sendCredits80Alert(userId: string, creditsRemaining: number): Promise<void> {
        await this.recordAlert(userId, 'credits_80', { creditsRemaining });
        console.log(`[ALERT] Credits 80% used for user ${userId}. Remaining: ${creditsRemaining}`);
    }

    async sendCredits100Alert(userId: string): Promise<void> {
        await this.recordAlert(userId, 'credits_100', {});
        console.log(`[ALERT] Credits exhausted for user ${userId}`);
    }

    async sendTopUpSuccessAlert(
        userId: string, 
        credits: number, 
        amount: number
    ): Promise<void> {
        await this.recordAlert(userId, 'topup_success', { 
            credits, 
            topUpAmount: amount.toString() 
        });
        console.log(`[ALERT] Top-up success for user ${userId}: ${credits} credits for $${amount}`);
    }

    async sendTopUpFailedAlert(userId: string, reason: string): Promise<void> {
        await this.recordAlert(userId, 'topup_failed', { errorMessage: reason });
        console.log(`[ALERT] Top-up failed for user ${userId}: ${reason}`);
    }

    async sendCap80Alert(userId: string): Promise<void> {
        await this.recordAlert(userId, 'cap_80', {});
        console.log(`[ALERT] Cap 80% reached for user ${userId}`);
    }

    async sendCapReachedAlert(userId: string): Promise<void> {
        await this.recordAlert(userId, 'cap_100', {});
        console.log(`[ALERT] Cap reached for user ${userId}`);
    }

    async sendRenewalSuccessAlert(userId: string): Promise<void> {
        await this.recordAlert(userId, 'renewal_success', {});
        console.log(`[ALERT] Renewal success for user ${userId}`);
    }

    async sendRenewalFailedAlert(userId: string): Promise<void> {
        await this.recordAlert(userId, 'renewal_failed', {});
        console.log(`[ALERT] Renewal failed for user ${userId}`);
    }

    async sendPaymentMethodExpiringAlert(userId: string, last4?: string): Promise<void> {
        await this.recordAlert(userId, 'payment_method_expiring', { last4 });
        console.log(`[ALERT] Payment method expiring for user ${userId}`);
    }

    async hasSentAlert(
        userId: string, 
        alertType: AlertType, 
        period: string
    ): Promise<boolean> {
        const periodStart = new Date(period);
        const alerts = await db
            .select()
            .from(billingAlerts)
            .where(and(
                eq(billingAlerts.userId, userId),
                eq(billingAlerts.alertType, alertType),
                gte(billingAlerts.sentAt, periodStart)
            ))
            .limit(1);

        return alerts.length > 0;
    }

    async recordAlert(
        userId: string, 
        alertType: AlertType, 
        metadata: Record<string, unknown>
    ): Promise<void> {
        await db.insert(billingAlerts).values({
            userId,
            alertType,
            metadata,
            sentAt: new Date(),
        });
    }

    async getAlertHistory(
        userId: string, 
        limit: number = 20
    ): Promise<typeof billingAlerts.$inferSelect[]> {
        return db
            .select()
            .from(billingAlerts)
            .where(eq(billingAlerts.userId, userId))
            .orderBy(desc(billingAlerts.sentAt))
            .limit(limit);
    }

    async getAlertConfig(alertType: AlertType): Promise<AlertConfig> {
        return this.alertConfigs[alertType];
    }

    async setAlertConfig(
        alertType: AlertType, 
        config: Partial<AlertConfig>
    ): Promise<void> {
        this.alertConfigs[alertType] = {
            ...this.alertConfigs[alertType],
            ...config,
        };
    }

    async resendAlert(userId: string, alertType: AlertType): Promise<boolean> {
        const config = this.alertConfigs[alertType];
        if (!config.enabled) {
            return false;
        }

        switch (alertType) {
            case 'credits_80':
                const balance = await this.getUserBalance(userId);
                await this.sendCredits80Alert(userId, balance);
                break;
            case 'credits_100':
                await this.sendCredits100Alert(userId);
                break;
            default:
                await this.recordAlert(userId, alertType, { manualResend: true });
        }

        return true;
    }

    private getCurrentPeriod(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }

    private async getUserBalance(userId: string): Promise<number> {
        const [user] = await db
            .select({
                credits: users.credits,
                rolloverCredits: users.rolloverCredits,
                purchasedCredits: users.purchasedCredits,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) return 0;
        return user.credits + user.rolloverCredits + user.purchasedCredits;
    }
}

export const billingAlertService = new BillingAlertService();
export default billingAlertService;
