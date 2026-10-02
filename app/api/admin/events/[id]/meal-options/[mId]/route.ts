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
  });
  if (!meal) {
    return NextResponse.json(
      { error: "Meal option not found" },
      { status: 404 }
    );
  }

  const [activeItems, activeTickets] = await Promise.all([
    db.orderItem.count({
      where: {
        mealOptionId: mId,
        order: { status: { not: "CANCELLED" } },
      },
    }),
    db.ticket.count({
      where: {
        mealOptionId: mId,
        status: { not: "CANCELLED" },
        order: { status: { not: "CANCELLED" } },
      },
    }),
  ]);
  const usedBy = Math.max(activeItems, activeTickets);
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (usedBy > 0 && !force) {
    const guests = usedBy === 1 ? "1 guest has" : `${usedBy} guests have`;
    return NextResponse.json(
      {
        error: `${guests} already chosen “${meal.name}”.`,
        inUse: true,
        usedBy,
      },
      { status: 400 }
    );
  }

  await db.$transaction([
    db.orderItem.updateMany({
      where: { mealOptionId: mId },
      data: { mealOptionId: null },
    }),
    db.ticket.updateMany({
      where: { mealOptionId: mId },
      data: { mealOptionId: null },
    }),
    db.mealOption.delete({ where: { id: mId } }),
  ]);
  return NextResponse.json({ ok: true });
}
