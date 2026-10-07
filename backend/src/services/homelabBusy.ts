import { HOMELAB_OVERDUE_GRACE_MS, getHomelabJobSettings } from './homelab.js';

/**
 * True when a homelab search has outlived its deadline without reaching a terminal
 * state. The clock starts when the job started (`apifyStartedAt`, set when the queue
 * dispatcher claims it), NOT when the search was created, so time spent waiting in
 * the queue never counts. `createdAt` is only a fallback for rows that never recorded
 * a start (searches created before the queue existed).
 */
export function isHomelabSearchOverdue(
    record: { apifyStartedAt: Date | null; createdAt: Date },
    now: Date = new Date(),
): boolean {
    const { maxTimeSeconds } = getHomelabJobSettings();
    const startedAt = record.apifyStartedAt ?? record.createdAt;
    return now.getTime() - startedAt.getTime() > maxTimeSeconds * 1000 + HOMELAB_OVERDUE_GRACE_MS;
}
