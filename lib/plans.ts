/**
 * Plan tiers (Phase 3).
 *
 * FREE: 1 published event at a time, 500 tickets per event, 2 team seats,
 *       public pages use the shared EventPass footer.
 * PRO (coming soon): unlimited events / tickets / seats.
 *
 * Platform admins can override any limit per organization
 * (Organization.max*Override); null override = plan default.
 *
 * All limits are enforced server-side; the UI only mirrors them.
 */
import { db } from "@/lib/db";
import {
  applyTempOverrides,
  isOverrideActive,
  type QuotaMetric,
  type QuotaOverrideRow,
} from "@/lib/quotaOverrides";

export type { QuotaMetric, QuotaOverrideRow };
export { isOverrideActive };

export type PlanId = "FREE" | "PRO";

export const PLANS: Record<
  PlanId,
  {
    name: string;
    priceCents: number; // per month, CAD
    maxActiveEvents: number | null; // null = unlimited
    maxTicketsPerEvent: number | null;
    maxSeats: number | null;
    showBadge: boolean;
    comingSoon: boolean;
  }
> = {
  FREE: {
    name: "Free",
    priceCents: 0,
    maxActiveEvents: 1,
    maxTicketsPerEvent: 500,
    maxSeats: 2,
    showBadge: true,
    comingSoon: false,
  },
  PRO: {
    name: "Pro",
    priceCents: 2900, // C$29/mo approved 2026-10-08 (C$290/yr = 2 months free)
    maxActiveEvents: null,
    maxTicketsPerEvent: null,
    maxSeats: null,
    showBadge: false,
    comingSoon: true, // Stripe wiring lands later; plan is grantable by platform admins now
  },
};

export function planOf(org: { plan?: string | null } | null): PlanId {
  return org?.plan === "PRO" ? "PRO" : "FREE";
}

type OrgLimits = {
  plan: PlanId;
  maxActiveEvents: number | null;
  maxTicketsPerEvent: number | null;
  maxSeats: number | null;
  showBadge: boolean;
};

/** Effective limits for an org: plan defaults with platform-admin overrides applied. */
export function effectiveLimits(org: {
  plan?: string | null;
  maxEventsOverride?: number | null;
  maxTicketsOverride?: number | null;
  maxSeatsOverride?: number | null;
}): OrgLimits {
  const plan = planOf(org);
  const base = PLANS[plan];
  return {
    plan,
    maxActiveEvents: org.maxEventsOverride ?? base.maxActiveEvents,
    maxTicketsPerEvent: org.maxTicketsOverride ?? base.maxTicketsPerEvent,
    maxSeats: org.maxSeatsOverride ?? base.maxSeats,
    showBadge: base.showBadge,
  };
}

// ---------------------------------------------------------------------------
// Temporary SaaS-owner quota overrides (OrganizationQuotaOverride).
// Pure merge logic lives in lib/quotaOverrides.ts (import-free, unit-tested).
// Monthly-meter metrics (MONTHLY_*) are stored for the meter-enforcement
// build; only static caps merge into OrgLimits today.
// ---------------------------------------------------------------------------

/** Load an org's currently-active temp quota overrides (for enforcement). */
export async function activeQuotaOverrides(
  organizationId: string,
  now: Date = new Date()
): Promise<QuotaOverrideRow[]> {
  const rows = await db.organizationQuotaOverride.findMany({
    where: {
      organizationId,
      revokedAt: null,
      createdAt: { lte: now },
      expiresAt: { gt: now },
    },
    select: {
      metric: true,
      value: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  return rows as QuotaOverrideRow[];
}

/**
 * Effective limits including active temporary SaaS-owner overrides.
 * Prefer this in enforcement paths; the sync effectiveLimits() stays for
 * pure plan+standing computation and UI mirrors.
 */
export async function effectiveLimitsAsync(
  organizationId: string
): Promise<OrgLimits> {
  const org = await loadOrg(organizationId);
  const base = effectiveLimits(org ?? {});
  const now = new Date();
  const overrides = await activeQuotaOverrides(organizationId, now);
  const merged = applyTempOverrides(
    {
      maxActiveEvents: base.maxActiveEvents,
      maxSeats: base.maxSeats,
    },
    overrides,
    now
  );
  return { ...base, ...merged };
}

async function loadOrg(organizationId: string) {
  return db.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan: true,
      maxEventsOverride: true,
      maxTicketsOverride: true,
      maxSeatsOverride: true,
    },
  });
}

/** True when the org may publish one more event right now. */
export async function canPublishEvent(
  organizationId: string,
  plan: PlanId
): Promise<{ ok: boolean; reason?: string }> {
  const limits = await effectiveLimitsAsync(organizationId);
  const limit = limits.maxActiveEvents;
  if (limit == null) return { ok: true };
  const active = await db.event.count({
    where: { organizationId, status: "PUBLISHED" },
  });
  if (active >= limit) {
    return {
      ok: false,
      reason: `Your ${PLANS[limits.plan].name} plan allows ${limit} published event at a time.`,
    };
  }
  return { ok: true };
}

/** True when the org may add one more team seat right now. */
export async function canAddSeat(
  organizationId: string,
  plan: PlanId
): Promise<{ ok: boolean; reason?: string }> {
  const limits = await effectiveLimitsAsync(organizationId);
  const limit = limits.maxSeats;
  if (limit == null) return { ok: true };
  const seats = await db.membership.count({ where: { organizationId } });
  if (seats >= limit) {
    return {
      ok: false,
      reason: `Your ${PLANS[limits.plan].name} plan allows ${limit} team seats.`,
    };
  }
  return { ok: true };
}

/**
 * True when the event may sell `qty` more tickets under the org's plan.
 * Counts non-cancelled tickets across all orders for the event.
 */
export async function canSellTickets(
  eventId: string,
  plan: PlanId,
  qty: number
): Promise<{ ok: boolean; reason?: string }> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      organization: {
        select: {
          plan: true,
          maxTicketsOverride: true,
        },
      },
    },
  });
  if (!event) return { ok: true }; // unknown event: nothing to enforce against
  const limits = event.organizationId
    ? await effectiveLimitsAsync(event.organizationId)
    : effectiveLimits({ plan });
  const limit = limits.maxTicketsPerEvent;
  if (limit == null) return { ok: true };
  const sold = await db.ticket.count({
    where: { ticketType: { eventId }, status: { not: "CANCELLED" } },
  });
  if (sold + qty > limit) {
    return {
      ok: false,
      reason: `This event has reached the ${limit}-ticket limit on the ${PLANS[limits.plan].name} plan.`,
    };
  }
  return { ok: true };
}
