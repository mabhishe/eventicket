import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { summarizePayments } from "@/lib/money";

/** Sales report for one event (or all events when no eventId). */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  const where = {
    status: { not: "CANCELLED" as const },
    event: { organizationId: orgId },
    ...(eventId ? { eventId } : {}),
  };

  const orders = await db.order.findMany({
    where,
    include: {
      items: {
        include: { ticketType: true, mealOption: true },
      },
      tickets: { include: { mealOption: true } },
      seller: { select: { name: true } },
      event: { select: { title: true, currency: true } },
      payments: { select: { kind: true, amountCents: true } },
    },
  });

  let collectedCents = 0;
  let outstandingCents = 0;
  let waivedCents = 0;
  let confirmedOrders = 0;

  const byTicketType: Record<
    string,
    { name: string; qty: number; revenueCents: number }
  > = {};
  const bySeller: Record<string, { name: string; orders: number; revenueCents: number }> =
    {};
  const meals: Record<
    string,
    {
      name: string;
      tag: string | null;
      total: number;
      checkedIn: number;
      collected: number;
      remaining: number;
    }
  > = {};
  let ticketsIssued = 0;
  let ticketsCheckedIn = 0;
  let foodCollected = 0;

  for (const o of orders) {
    const sum = summarizePayments(o.payments, o.totalCents);
    const legacyPaid = o.payments.length === 0 && o.status === "CONFIRMED";
    collectedCents += legacyPaid ? o.totalCents : sum.net;
    waivedCents += sum.waived;
    if (o.status === "PENDING_PAYMENT") {
      outstandingCents += Math.max(0, o.totalCents - sum.net - sum.waived);
    }
    const inDoor = o.status === "CONFIRMED" || o.emergencyAdmittedAt != null;
    if (o.status === "CONFIRMED") confirmedOrders += 1;
    if (!inDoor && o.status !== "CONFIRMED") {
      continue;
    }
    if (o.status !== "CONFIRMED") {
      for (const t of o.tickets) {
        ticketsIssued += 1;
        if (t.status === "CHECKED_IN") ticketsCheckedIn += 1;
        if (t.foodCollectedAt) foodCollected += 1;
        if (t.mealOptionId && t.mealOption) {
          meals[t.mealOptionId] = meals[t.mealOptionId] ?? {
            name: t.mealOption.name,
            tag: t.mealOption.tag,
            total: 0,
            checkedIn: 0,
            collected: 0,
            remaining: 0,
          };
          meals[t.mealOptionId].total += 1;
          if (t.status === "CHECKED_IN") meals[t.mealOptionId].checkedIn += 1;
          if (t.foodCollectedAt) meals[t.mealOptionId].collected += 1;
        }
      }
      continue;
    }
    for (const it of o.items) {
      const key = it.ticketTypeId;
      byTicketType[key] = byTicketType[key] ?? {
        name: it.ticketType.name,
        qty: 0,
        revenueCents: 0,
      };
      byTicketType[key].qty += it.qty;
      byTicketType[key].revenueCents += it.unitPriceCents * it.qty;
    }
    const sellerKey = o.sellerId ?? "online";
    const sellerName = o.seller?.name ?? "Online / self-serve";
    bySeller[sellerKey] = bySeller[sellerKey] ?? {
      name: sellerName,
      orders: 0,
      revenueCents: 0,
    };
    bySeller[sellerKey].orders += 1;
    bySeller[sellerKey].revenueCents += legacyPaid ? o.totalCents : sum.net;

    for (const t of o.tickets) {
      ticketsIssued += 1;
      if (t.status === "CHECKED_IN") ticketsCheckedIn += 1;
      if (t.foodCollectedAt) foodCollected += 1;
      if (t.mealOptionId && t.mealOption) {
        meals[t.mealOptionId] = meals[t.mealOptionId] ?? {
          name: t.mealOption.name,
          tag: t.mealOption.tag,
          total: 0,
          checkedIn: 0,
          collected: 0,
          remaining: 0,
        };
        meals[t.mealOptionId].total += 1;
        if (t.status === "CHECKED_IN") meals[t.mealOptionId].checkedIn += 1;
        if (t.foodCollectedAt) meals[t.mealOptionId].collected += 1;
      }
    }
  }
  for (const m of Object.values(meals)) {
    m.remaining = m.total - m.collected;
  }

  return NextResponse.json({
    summary: {
      orders: confirmedOrders,
      revenueCents: collectedCents,
      collectedCents,
      outstandingCents,
      waivedCents,
      ticketsIssued,
      ticketsCheckedIn,
      foodCollected,
    },
    byTicketType: Object.values(byTicketType),
    bySeller: Object.values(bySeller),
    meals: Object.values(meals),
  });
}
