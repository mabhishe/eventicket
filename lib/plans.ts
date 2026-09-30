/**
 * Plan tiers (Phase 3).
 *
 * FREE: 1 published event at a time, 100 tickets per event, 2 team seats,
 *       "Powered by EventPass" badge shown on public pages.
 * PRO:  unlimited events / tickets / seats, badge removed, priority support.
 *
 * All limits are enforced server-side; the UI only mirrors them.
 */
import { db } from "@/lib/db";

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
  }
> = {
  FREE: {
    name: "Free",
    priceCents: 0,
    maxActiveEvents: 1,
    maxTicketsPerEvent: 100,
    maxSeats: 2,
    showBadge: true,
  },
  PRO: {
    name: "Pro",
    priceCents: 1900,
    maxActiveEvents: null,
    maxTicketsPerEvent: null,
    maxSeats: null,
    showBadge: false,
  },
};

export function planOf(org: { plan?: string | null } | null): PlanId {
  return org?.plan === "PRO" ? "PRO" : "FREE";
}

/** True when the org may publish one more event right now. */
export async function canPublishEvent(
  organizationId: string,
  plan: PlanId
): Promise<{ ok: boolean; reason?: string }> {
  const limit = PLANS[plan].maxActiveEvents;
  if (limit == null) return { ok: true };
  const active = await db.event.count({
    where: { organizationId, status: "PUBLISHED" },
  });
  if (active >= limit) {
    return {
      ok: false,
      reason: `Your ${PLANS[plan].name} plan allows ${limit} published event at a time. Upgrade to Pro for unlimited events.`,
    };
  }
  return { ok: true };
}

/** True when the org may add one more team seat right now. */
export async function canAddSeat(
  organizationId: string,
  plan: PlanId
): Promise<{ ok: boolean; reason?: string }> {
  const limit = PLANS[plan].maxSeats;
  if (limit == null) return { ok: true };
  const seats = await db.membership.count({ where: { organizationId } });
  if (seats >= limit) {
    return {
      ok: false,
      reason: `Your ${PLANS[plan].name} plan allows ${limit} team seats. Upgrade to Pro for unlimited seats.`,
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
  const limit = PLANS[plan].maxTicketsPerEvent;
  if (limit == null) return { ok: true };
  const sold = await db.ticket.count({
    where: { ticketType: { eventId }, status: { not: "CANCELLED" } },
  });
  if (sold + qty > limit) {
    return {
      ok: false,
      reason: `This event has reached the ${limit}-ticket limit on the ${PLANS[plan].name} plan. Ask the organizer to upgrade to Pro.`,
    };
  }
  return { ok: true };
}
