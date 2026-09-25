import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";

/** Public endpoint: a guest places an order (status PENDING_PAYMENT). */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const eventId = String(body.eventId || "");
  const items = body.items;
  const payMethod = String(body.payMethod || "");
  if (!eventId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Please select at least one ticket" },
      { status: 400 }
    );
  }
  if (!["ETRANSFER", "ZELLE", "CASH"].includes(payMethod)) {
    return NextResponse.json(
      { error: "Please choose a payment method" },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder({
      eventId,
      buyerName: String(body.buyerName || ""),
      buyerEmail: String(body.buyerEmail || "").trim() || undefined,
      buyerPhone: String(body.buyerPhone || "").trim() || undefined,
      payMethod: payMethod as "ETRANSFER" | "ZELLE" | "CASH",
      notes: String(body.notes || "").trim() || undefined,
      inviteCode: String(body.inviteCode || "").trim() || undefined,
      showOnWall: body.showOnWall === true,
      items: items.map((it: Record<string, unknown>) => ({
        ticketTypeId: String(it.ticketTypeId),
        qty: Number(it.qty),
        mealOptionId: it.mealOptionId ? String(it.mealOptionId) : null,
        holderName: it.holderName ? String(it.holderName) : null,
      })),
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not place order" },
      { status: 400 }
    );
  }
}
