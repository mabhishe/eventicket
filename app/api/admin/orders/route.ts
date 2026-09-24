import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

/** List orders, optionally filtered by event and/or status. */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN", "SELLER"]);
  if (!auth.ok) return auth.error;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  const status = searchParams.get("status");

  const orders = await db.order.findMany({
    where: {
      ...(eventId ? { eventId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      event: { select: { title: true } },
      seller: { select: { name: true } },
      items: { include: { ticketType: true, mealOption: true } },
      _count: { select: { tickets: true } },
    },
  });
  return NextResponse.json({ orders });
}
