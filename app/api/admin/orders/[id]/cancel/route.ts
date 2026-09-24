import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN", "SELLER"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ order });
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: { orderId: id },
      data: { status: "CANCELLED" },
    });
    return tx.order.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  });
  return NextResponse.json({ order: updated });
}
