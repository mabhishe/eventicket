import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  addOrderItems,
  cancelOrder,
  updatePendingOrderDetails,
  type NewOrderItem,
} from "@/lib/orders";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ id: string }> };

const CHANGE_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 };

/** The order link is not enough to change or cancel it. */
function checkoutConfirmed(
  order: { buyerEmail: string | null; buyerPhone: string | null },
  raw: unknown
): boolean {
  const given = String(raw || "").trim();
  if (!given) return false;
  const email = (order.buyerEmail || "").trim().toLowerCase();
  if (email && given.toLowerCase() === email) return true;
  const phone = (order.buyerPhone || "").replace(/\D/g, "");
  const givenDigits = given.replace(/\D/g, "");
  return !!phone && !!givenDigits && givenDigits === phone;
}

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
          timezone: true,
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
 * Public: edit a pending order. The guest must re-enter the checkout email
 * or phone (`confirmContact`). The order link alone is not enough.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const rl = checkRateLimit(`order-change:${clientIp(req)}:${id}`, CHANGE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const order = await db.order.findUnique({
    where: { id },
    select: { buyerEmail: true, buyerPhone: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!checkoutConfirmed(order, body.confirmContact)) {
    return NextResponse.json(
      { error: "Enter the email or phone from checkout to change this order." },
      { status: 403 }
    );
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
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const rl = checkRateLimit(`order-change:${clientIp(req)}:${id}`, CHANGE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!checkoutConfirmed(order, body.confirmContact)) {
    return NextResponse.json(
      { error: "Enter the email or phone from checkout to change this order." },
      { status: 403 }
    );
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
