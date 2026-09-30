import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { PLANS, effectiveLimits } from "@/lib/plans";

/** Current plan + usage for the active org. Any signed-in team member. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, [
    "ORG_OWNER",
    "ORG_ADMIN",
    "ORG_STAFF",
    "ORG_DOOR",
  ]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      plan: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      maxEventsOverride: true,
      maxTicketsOverride: true,
      maxSeatsOverride: true,
    },
  });
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const limits = effectiveLimits(org);
  const plan = limits.plan;
  const [activeEvents, seats, ticketsSold] = await Promise.all([
    db.event.count({ where: { organizationId: orgId, status: "PUBLISHED" } }),
    db.membership.count({ where: { organizationId: orgId } }),
    db.ticket.count({
      where: {
        status: { not: "CANCELLED" },
        ticketType: { event: { organizationId: orgId } },
      },
    }),
  ]);

  return NextResponse.json({
    plan,
    planName: PLANS[plan].name,
    subscriptionStatus: org.subscriptionStatus || "NONE",
    hasBillingAccount: !!org.stripeCustomerId,
    limits: {
      maxActiveEvents: limits.maxActiveEvents,
      maxTicketsPerEvent: limits.maxTicketsPerEvent,
      maxSeats: limits.maxSeats,
      showBadge: limits.showBadge,
    },
    usage: { activeEvents, seats, ticketsSold },
    proPriceCents: PLANS.PRO.priceCents,
  });
}
