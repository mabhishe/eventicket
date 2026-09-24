import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  addOrderItems,
  cancelOrder,
  updatePendingOrderDetails,
  type NewOrderItem,
} from "@/lib/orders";

type Ctx = { params: Promise<{ id: string }> };

/** Public: order status + payment instructions. No auth (guest flow). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          slug: true,
          title: true,
          date: true,
          venue: true,
          currency: true,
          etransferEmail: true,
          zelleHandle: true,
          cashNote: true,
        },
      },
      items: { include: { ticketType: true, mealOption: true } },
      tickets: {
        include: { ticketType: true, mealOption: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json({ order });
}

/**
 * Public: edit a pending order. No auth (guest flow) — the order id is an
 * unguessable cuid, the same protection as the public order page itself.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    if (body.action === "add-items") {
      const items = (body.items || []) as NewOrderItem[];
      const order = await addOrderItems(id, items);
      return NextResponse.json({ order });
    }
    if (body.action === "update-details") {
      const order = await updatePendingOrderDetails(id, {
        buyerName:
          body.buyerName === undefined ? undefined : String(body.buyerName),
        buyerEmail:
          body.buyerEmail === undefined ? undefined : String(body.buyerEmail),
        buyerPhone:
          body.buyerPhone === undefined ? undefined : String(body.buyerPhone),
        holderNames:
          body.holderNames === undefined
            ? undefined
            : (body.holderNames as Record<string, string>),
      });
      return NextResponse.json({ order });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update order" },
      { status: 400 }
    );
  }
}

/** Public: cancel a pending (unpaid) order. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ order });
  }
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: "Only unpaid orders can be cancelled" },
      { status: 400 }
    );
  }
  const updated = await cancelOrder(id);
  return NextResponse.json({ order: updated });
}
