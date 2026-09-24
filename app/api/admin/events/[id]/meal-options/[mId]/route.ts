import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string; mId: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id, mId } = await params;

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
