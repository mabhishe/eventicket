import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { cancelOrder } from "@/lib/orders";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id, event: { organizationId: orgId } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ order });
  }

  const updated = await cancelOrder(id);
  return NextResponse.json({ order: updated });
}
