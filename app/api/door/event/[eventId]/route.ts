import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { ticketAvailability } from "@/lib/orders";

type Ctx = { params: Promise<{ eventId: string }> };

/** Door console data: event, ticket types with live availability, meal counts. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN", "DOOR"]);
  if (!auth.ok) return auth.error;
  const { eventId } = await params;

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      mealOptions: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const availability = await ticketAvailability(eventId);

  const tickets = await db.ticket.findMany({
    where: { order: { eventId, status: "CONFIRMED" } },
    select: {
      status: true,
      foodCollectedAt: true,
      mealOptionId: true,
      mealOption: { select: { name: true, tag: true } },
    },
  });
  const issued = tickets.length;
  const checkedIn = tickets.filter((t) => t.status === "CHECKED_IN").length;
  const foodCollected = tickets.filter((t) => t.foodCollectedAt).length;

  const meals: Record<
    string,
    { name: string; tag: string | null; total: number; checkedIn: number; collected: number }
  > = {};
  for (const m of event.mealOptions) {
    meals[m.id] = {
      name: m.name,
      tag: m.tag,
      total: 0,
      checkedIn: 0,
      collected: 0,
    };
  }
  for (const t of tickets) {
    if (t.mealOptionId && meals[t.mealOptionId]) {
      meals[t.mealOptionId].total += 1;
      if (t.status === "CHECKED_IN") meals[t.mealOptionId].checkedIn += 1;
      if (t.foodCollectedAt) meals[t.mealOptionId].collected += 1;
    }
  }

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      date: event.date,
      venue: event.venue,
      currency: event.currency,
      status: event.status,
    },
    ticketTypes: event.ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      priceCents: t.priceCents,
      includesMeal: t.includesMeal,
      left: availability[t.id]?.left ?? 0,
    })),
    mealOptions: event.mealOptions,
    counts: { issued, checkedIn, foodCollected },
    meals: Object.values(meals),
  });
}
