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
  return NextResponse.json({ event: rest, availability });
}
