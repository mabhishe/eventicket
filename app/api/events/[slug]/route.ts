import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ticketAvailability } from "@/lib/orders";
import { sortSponsorAds } from "@/lib/sponsors";

type Ctx = { params: Promise<{ slug: string }> };

/** Public: published event details + live availability for the buy page. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      mealOptions: { orderBy: { sortOrder: "asc" } },
      programItems: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      sponsorAds: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!event || event.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const availability = await ticketAvailability(event.id);
  const { ...rest } = event;
  (rest as { sponsorAds: unknown }).sponsorAds = sortSponsorAds(event.sponsorAds);
  // Who's-going wall: confirmed orders that opted in. First name + last
  // initial only, so buyers aren't doxxed by full name.
  const wallOrders = await db.order.findMany({
    where: { eventId: event.id, status: "CONFIRMED", showOnWall: true },
    select: {
      buyerName: true,
      tickets: { select: { status: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const attendeeWall = wallOrders.map((o) => {
    const parts = o.buyerName.trim().split(/\s+/);
    const display =
      parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0];
    return {
      name: display,
      partySize: o.tickets.filter((t) => t.status !== "CANCELLED").length,
    };
  });
  return NextResponse.json({ event: rest, availability, attendeeWall });
}
