import { NextRequest, NextResponse } from "next/server";
import { requireOrgApiUser } from "@/lib/auth";
import { confirmPendingOrder } from "@/lib/confirmOrder";

type Ctx = { params: Promise<{ id: string }> };

/** Mark a PENDING_PAYMENT order CONFIRMED and issue its tickets. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id } = await params;

  const result = await confirmPendingOrder({
    orderId: id,
    orgId,
    confirmedById: auth.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    order: result.order,
    tickets: result.tickets,
    ...(result.already ? { already: true } : {}),
  });
}
