import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { createOrder, issueTickets } from "@/lib/orders";

/**
 * Walk-in sale at the door: creates a CONFIRMED (paid) order and issues
 * tickets immediately. Optionally checks them in right away.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN", "SELLER", "DOOR"]);
  if (!auth.ok) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const eventId = String(body.eventId || "");
  const items = body.items;
  if (!eventId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "eventId and items are required" },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder({
      eventId,
      buyerName: String(body.buyerName || "Walk-in").trim() || "Walk-in",
      buyerEmail: String(body.buyerEmail || "").trim() || undefined,
      buyerPhone: String(body.buyerPhone || "").trim() || undefined,
      payMethod: "CASH",
      notes: String(body.notes || "").trim() || "Walk-in sale",
      sellerId: auth.user.id,
      status: "CONFIRMED",
      items: items.map((it: Record<string, unknown>) => ({
        ticketTypeId: String(it.ticketTypeId),
        qty: Number(it.qty),
        mealOptionId: it.mealOptionId ? String(it.mealOptionId) : null,
        holderName: it.holderName ? String(it.holderName) : null,
      })),
    });
    const tickets = await issueTickets(order.id);

    if (body.checkIn === true) {
      await db.ticket.updateMany({
        where: { orderId: order.id },
        data: { status: "CHECKED_IN", checkedInAt: new Date() },
      });
    }
    const full = await db.order.findUnique({
      where: { id: order.id },
      include: {
        items: { include: { ticketType: true, mealOption: true } },
        tickets: { include: { ticketType: true, mealOption: true } },
      },
    });
    return NextResponse.json({ order: full, tickets }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create sale" },
      { status: 400 }
    );
  }
}
