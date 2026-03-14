import { db } from '../db';
import { billingEvents, users } from '../db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

export interface AuditEntry {
    id: string;
    userId: string;
    userEmail?: string;
    eventType: string;
    creditDelta: number;
    moneyAmount: string | null;
    adminId: string | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
}

export interface AdminActionLog {
    id: string;
    adminId: string;
    adminEmail?: string;
    action: string;
    targetUserId: string;
    targetUserEmail?: string;
    beforeValue: unknown;
    afterValue: unknown;
    reason: string | null;
    createdAt: Date;
}

class AuditLogService {
    async logAdminAction(
        adminId: string,
        action: string,
        targetUserId: string,
        beforeValue: unknown,
        afterValue: unknown,
        reason?: string
    ): Promise<void> {
        await db.insert(billingEvents).values({
            userId: targetUserId,
            eventType: 'adjustment',
            creditDelta: 0,
            adminId,
            reason: `${action}: ${reason || 'No reason provided'}`,
            metadata: {
                action,
                beforeValue,
                afterValue,
                adminAction: true,
            },
        });

        console.log(`[AUDIT] Admin ${adminId} performed "${action}" on user ${targetUserId}`);
    }

    async logCreditChange(
        userId: string,
        eventType: 'adjustment' | 'compensation' | 'promotional',
        creditDelta: number,
        adminId?: string,
        reason?: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await db.insert(billingEvents).values({
            userId,
            eventType,
            creditDelta,
            adminId,
            reason,
            metadata: metadata || {},
        });
    }

    async getAuditTrail(userId: string, limit: number = 50): Promise<AuditEntry[]> {
        const events = await db
            .select()
            .from(billingEvents)
            .where(eq(billingEvents.userId, userId))
            .orderBy(desc(billingEvents.createdAt))
            .limit(limit);

        return events.map(event => ({
            id: event.id,
            userId: event.userId,
            eventType: event.eventType,
            creditDelta: event.creditDelta,
            moneyAmount: event.moneyAmount,
            adminId: event.adminId,
            reason: event.reason,
            metadata: event.metadata,
            createdAt: event.createdAt,
        }));
    }

    async getAdminActionLog(
        adminId?: string,
        limit: number = 100
    ): Promise<AdminActionLog[]> {
        let query = db
            .select()
            .from(billingEvents)
            .where(eq(billingEvents.eventType, 'adjustment'));

        if (adminId) {
            query = db
                .select()
                .from(billingEvents)
                .where(and(
                    eq(billingEvents.eventType, 'adjustment'),
                    eq(billingEvents.adminId, adminId)
                ));
        }

        const events = await query
            .orderBy(desc(billingEvents.createdAt))
            .limit(limit);

        const logs: AdminActionLog[] = [];

        for (const event of events) {
            const metadata = event.metadata as Record<string, unknown> | null;
            if (metadata?.adminAction) {
                logs.push({
                    id: event.id,
                    adminId: event.adminId || '',
                    action: metadata.action as string || 'unknown',
                    targetUserId: event.userId,
                    beforeValue: metadata.beforeValue,
                    afterValue: metadata.afterValue,
                    reason: event.reason,
                    createdAt: event.createdAt,
                });
            }
        }

        return logs;
    }

    async getRecentActions(limit: number = 100): Promise<AuditEntry[]> {
        const events = await db
            .select()
            .from(billingEvents)
            .orderBy(desc(billingEvents.createdAt))
            .limit(limit);

        return events.map(event => ({
            id: event.id,
            userId: event.userId,
            eventType: event.eventType,
            creditDelta: event.creditDelta,
            moneyAmount: event.moneyAmount,
            adminId: event.adminId,
            reason: event.reason,
            metadata: event.metadata,
            createdAt: event.createdAt,
        }));
    }

    async getActionsByDateRange(
        startDate: Date,
        endDate: Date,
        userId?: string
    ): Promise<AuditEntry[]> {
        const conditions = [
            gte(billingEvents.createdAt, startDate),
            lte(billingEvents.createdAt, endDate),
        ];

        if (userId) {
            conditions.push(eq(billingEvents.userId, userId));
        }

        const events = await db
            .select()
            .from(billingEvents)
            .where(and(...conditions))
            .orderBy(desc(billingEvents.createdAt));

        return events.map(event => ({
            id: event.id,
            userId: event.userId,
            eventType: event.eventType,
            creditDelta: event.creditDelta,
            moneyAmount: event.moneyAmount,
            adminId: event.adminId,
            reason: event.reason,
            metadata: event.metadata,
            createdAt: event.createdAt,
        }));
    }

    async getCreditAdjustmentSummary(
        adminId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        totalAdjustments: number;
        creditsAdded: number;
        creditsRemoved: number;
        userCount: number;
    }> {
        const conditions = [
            eq(billingEvents.adminId, adminId),
            eq(billingEvents.eventType, 'adjustment'),
        ];

        if (startDate) {
            conditions.push(gte(billingEvents.createdAt, startDate));
        }
        if (endDate) {
            conditions.push(lte(billingEvents.createdAt, endDate));
        }

        const events = await db
            .select()
            .from(billingEvents)
            .where(and(...conditions));

        const userIds = new Set<string>();
        let creditsAdded = 0;
        let creditsRemoved = 0;

        for (const event of events) {
            userIds.add(event.userId);
            if (event.creditDelta > 0) {
                creditsAdded += event.creditDelta;
            } else {
                creditsRemoved += Math.abs(event.creditDelta);
            }
        }

        return {
            totalAdjustments: events.length,
            creditsAdded,
            creditsRemoved,
            userCount: userIds.size,
        };
    }
}

export const auditLogService = new AuditLogService();
export default auditLogService;
