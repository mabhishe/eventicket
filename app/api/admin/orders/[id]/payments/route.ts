import { NextRequest, NextResponse } from "next/server";
import { requireOrgApiUser } from "@/lib/auth";
import { parseDollarsToCents } from "@/lib/money";
import { recordPayment, type PaymentKindInput } from "@/lib/payments";

type Ctx = { params: Promise<{ id: string }> };

/** Record money received, a refund, or a waiver against an order. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const kind = String(body.kind || "");
  if (kind !== "RECEIVED" && kind !== "REFUND" && kind !== "WAIVER") {
    return NextResponse.json({ error: "Unknown payment type" }, { status: 400 });
  }
  const amountCents =
    typeof body.amountCents === "number"
      ? Math.round(body.amountCents)
      : parseDollarsToCents(String(body.amount ?? ""));
  if (amountCents == null) {
    return NextResponse.json(
      { error: "Enter a valid amount, like 40 or 40.50" },
      { status: 400 }
    );
  }

  try {
    const payment = await recordPayment({
      orderId: id,
      orgId: auth.user.orgId,
      userId: auth.user.id,
      kind: kind as PaymentKindInput,
      amountCents,
      reason: body.reason == null ? null : String(body.reason),
      method: body.method == null ? null : String(body.method),
    });
    return NextResponse.json({ payment }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not record payment";
    const status = message === "Order not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
