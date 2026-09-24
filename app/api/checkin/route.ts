import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { extractCode } from "@/lib/tickets";

/** Door check-in: validate a ticket code and mark it CHECKED_IN. */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN", "DOOR"]);
  if (!auth.ok) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const raw = String(body.code || "");
  const eventId = String(body.eventId || "");
  if (!raw) {
    return NextResponse.json({ error: "Ticket code required" }, { status: 400 });
  }

  const ticket = await db.ticket.findUnique({
    where: { code: extractCode(raw) },
    include: {
      ticketType: { select: { name: true } },
      mealOption: { select: { name: true } },
      order: {
        select: {
          buyerName: true,
          status: true,
          eventId: true,
          event: { select: { title: true } },
        },
      },
    },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (eventId && ticket.order.eventId !== eventId) {
    return NextResponse.json(
      { error: `This ticket is for "${ticket.order.event.title}", not this event` },
      { status: 400 }
    );
  }
  if (ticket.status === "CANCELLED") {
    return NextResponse.json({ error: "Ticket was cancelled" }, { status: 400 });
  }
  if (ticket.order.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "Ticket's order is not confirmed yet" },
      { status: 400 }
    );
  }
  if (ticket.status === "CHECKED_IN") {
    return NextResponse.json({ ticket, already: true });
  }

  const updated = await db.ticket.update({
    where: { id: ticket.id },
    data: { status: "CHECKED_IN", checkedInAt: new Date() },
    include: {
      ticketType: { select: { name: true } },
      mealOption: { select: { name: true } },
      order: { select: { buyerName: true, event: { select: { title: true } } } },
    },
  });
  return NextResponse.json({ ticket: updated, already: false });
}
