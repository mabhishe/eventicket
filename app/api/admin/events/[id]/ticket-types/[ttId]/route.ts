import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string; ttId: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id, ttId } = await params;
  const eventOk = await db.event.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!eventOk) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

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
