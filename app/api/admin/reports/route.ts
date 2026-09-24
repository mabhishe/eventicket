import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

/** Sales report for one event (or all events when no eventId). */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");

  const where = {
    status: "CONFIRMED" as const,
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
    },
  });

  const revenueCents = orders.reduce((s, o) => s + o.totalCents, 0);

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
    bySeller[sellerKey].revenueCents += o.totalCents;

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
      orders: orders.length,
      revenueCents,
      ticketsIssued,
      ticketsCheckedIn,
      foodCollected,
    },
    byTicketType: Object.values(byTicketType),
    bySeller: Object.values(bySeller),
    meals: Object.values(meals),
  });
}
