import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string; mId: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id, mId } = await params;
  const eventOk = await db.event.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!eventOk) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const meal = await db.mealOption.findFirst({
    where: { id: mId, eventId: id },
    include: { _count: { select: { orderItems: true, tickets: true } } },
  });
  if (!meal) {
    return NextResponse.json(
      { error: "Meal option not found" },
      { status: 404 }
    );
  }
  if (meal._count.orderItems > 0 || meal._count.tickets > 0) {
    return NextResponse.json(
      { error: "Cannot delete a meal option that is in use" },
      { status: 400 }
    );
  }
  await db.mealOption.delete({ where: { id: mId } });
  return NextResponse.json({ ok: true });
}
