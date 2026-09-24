import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Privacy-conscious ticket lookup. The guest must provide the exact email
 * or phone they ordered with, plus their name. Only matching order links
 * are returned — no ticket codes or other guests' details.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const name = String(body.name || "").trim();
  const contact = String(body.contact || "").trim();
  if (!name || !contact) {
    return NextResponse.json(
      { error: "Please enter your name and the email or phone you ordered with" },
      { status: 400 }
    );
  }

  const orders = await db.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [{ buyerEmail: contact }, { buyerPhone: contact }],
    },
    include: {
      event: { select: { title: true, date: true, status: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const needle = name.toLowerCase();
  const matches = orders
    .filter((o) => o.buyerName.toLowerCase().includes(needle))
    .map((o) => ({
      orderId: o.id,
      eventTitle: o.event.title,
      eventDate: o.event.date,
      status: o.status,
      tickets: o._count.tickets,
    }));

  return NextResponse.json({ orders: matches });
}
