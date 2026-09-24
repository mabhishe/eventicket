import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { issueTickets } from "@/lib/orders";

type Ctx = { params: Promise<{ id: string }> };

/** Mark a PENDING_PAYMENT order CONFIRMED and issue its tickets. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN", "SELLER"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "CONFIRMED") {
    const tickets = await issueTickets(id); // idempotent
    return NextResponse.json({ order, tickets, already: true });
  }
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: `Order is ${order.status}` },
      { status: 400 }
    );
  }

  const updated = await db.order.update({
    where: { id },
    data: { status: "CONFIRMED" },
  });
  const tickets = await issueTickets(id);
  return NextResponse.json({ order: updated, tickets });
}
