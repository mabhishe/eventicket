import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Public: order status + payment instructions. No auth (guest flow). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      event: {
        select: {
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
