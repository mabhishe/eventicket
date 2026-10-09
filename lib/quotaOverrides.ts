/**
 * Pure quota-override logic (no imports — safe to unit-test with plain node).
 *
 * Temporary SaaS-owner quota overrides (OrganizationQuotaOverride) are a
 * ceiling lift, never a plan change: numeric quotas only, no feature gates,
 * invisible to the organizer, enforced purely by clock-read.
 * A row counts only while: revokedAt IS NULL AND createdAt <= now < expiresAt.
 * No cron needed; expired rows are simply never read.
 */

export type QuotaMetric =
  | "MONTHLY_BOOKINGS"
  | "MONTHLY_EMAILS"
  | "MONTHLY_WHATSAPP"
  | "MAX_EVENTS"
  | "MAX_SEATS";

export type QuotaOverrideRow = {
  metric: QuotaMetric;
  value: number;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type StaticLimits = {
  maxActiveEvents: number | null; // null = unlimited
  maxSeats: number | null;
};

/** True while the override row is in force at `now`. No cron needed. */
export function isOverrideActive(
  o: QuotaOverrideRow,
  now: Date = new Date()
): boolean {
  return o.revokedAt == null && o.createdAt <= now && now < o.expiresAt;
}

/**
 * True when a monthly-meter override covers any part of the given calendar
 * month. Used when the monthly meters (bookings/emails/WhatsApp) are
 * enforced: the override raises the ceiling for every month it overlaps.
 */
export function isOverrideActiveForMonth(
  o: QuotaOverrideRow,
  year: number,
  month: number // 1-12
): boolean {
  if (o.revokedAt != null) return false;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  return o.createdAt < monthEnd && monthStart < o.expiresAt;
}

/**
 * Pure merge: apply active temp overrides onto static limits.
 * Max wins across overlapping rows; an override can only RAISE a ceiling,
 * never lower it; "unlimited" (null) stays unlimited.
 */
export function applyTempOverrides(
  limits: StaticLimits,
  overrides: QuotaOverrideRow[],
  now: Date = new Date()
): StaticLimits {
  const best = new Map<QuotaMetric, number>();
  for (const o of overrides) {
    if (!isOverrideActive(o, now)) continue;
    if (!Number.isInteger(o.value) || o.value < 0) continue;
    const prev = best.get(o.metric);
    if (prev === undefined || o.value > prev) best.set(o.metric, o.value);
  }
  const raise = (
    current: number | null,
    metric: QuotaMetric
  ): number | null => {
    const v = best.get(metric);
    if (v === undefined || current == null) return current;
    return Math.max(current, v);
  };
  return {
    maxActiveEvents: raise(limits.maxActiveEvents, "MAX_EVENTS"),
    maxSeats: raise(limits.maxSeats, "MAX_SEATS"),
  };
}
