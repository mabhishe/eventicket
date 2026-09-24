import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string; ttId: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id, ttId } = await params;

  const tt = await db.ticketType.findFirst({
    where: { id: ttId, eventId: id },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!tt) {
    return NextResponse.json(
      { error: "Ticket type not found" },
      { status: 404 }
    );
  }
  if (tt._count.orderItems > 0) {
    return NextResponse.json(
      { error: "Cannot delete a ticket type that has orders" },
      { status: 400 }
    );
  }
  await db.ticketType.delete({ where: { id: ttId } });
  return NextResponse.json({ ok: true });
}
