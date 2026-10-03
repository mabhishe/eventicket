import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

// Stops someone walking the guest list with a partial name.
const LOOKUP_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 };

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Privacy-conscious ticket lookup. The guest must provide the exact email
 * or phone they ordered with, plus the full name on the order. Only matching
 * order links are returned — no ticket codes or other guests' details.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`find-tickets:${clientIp(req)}`, LOOKUP_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many lookups. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

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
      { error: "Please enter your full name and the email or phone you ordered with" },
      { status: 400 }
    );
  }

  const emailContact = contact.includes("@") ? contact.toLowerCase() : contact;
  const orders = await db.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [{ buyerEmail: emailContact }, { buyerPhone: contact }],
    },
    include: {
      event: { select: { title: true, date: true, status: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const needle = normName(name);
  const matches = orders
    .filter((o) => normName(o.buyerName) === needle)
    .map((o) => ({
      orderId: o.id,
      eventTitle: o.event.title,
      eventDate: o.event.date,
      status: o.status,
      tickets: o._count.tickets,
    }));

  return NextResponse.json({ orders: matches });
}
