import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

/** Door: search tickets by code, buyer name, or holder name within an event. */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN", "DOOR"]);
  if (!auth.ok) return auth.error;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  const q = (searchParams.get("q") || "").trim();
  if (!eventId || !q) {
    return NextResponse.json({ tickets: [] });
  }

  const tickets = await db.ticket.findMany({
    where: {
      order: { eventId, status: "CONFIRMED" },
      status: { not: "CANCELLED" },
      OR: [
        { code: { contains: q.toUpperCase() } },
        { holderName: { contains: q } },
        { order: { buyerName: { contains: q } } },
        { order: { refCode: q.toUpperCase() } },
      ],
    },
    take: 25,
    orderBy: { createdAt: "asc" },
    include: {
      ticketType: { select: { name: true } },
      mealOption: { select: { name: true, tag: true } },
      order: { select: { buyerName: true } },
    },
  });
  return NextResponse.json({ tickets });
}
