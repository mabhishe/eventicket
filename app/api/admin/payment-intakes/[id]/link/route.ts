import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { recordPayment } from "@/lib/payments";
import { summarizePayments } from "@/lib/money";
import { confirmPendingOrder } from "@/lib/confirmOrder";
import { orgHasPaymentAutoMatch } from "@/lib/paymentIntake";

type Ctx = { params: Promise<{ id: string }> };

/** Staff links a NEEDS_REVIEW intake to an order (records payment, may confirm). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId, id: userId } = auth.user;
  const { id } = await params;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, paymentAutoMatchEnabled: true },
  });
  if (!org || !orgHasPaymentAutoMatch(org)) {
    return NextResponse.json({ error: "Payment auto-match is not enabled" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const orderId = String(body.orderId || "").trim();
  const refCode = String(body.refCode || "").trim().toUpperCase();
  if (!orderId && !refCode) {
    return NextResponse.json(
      { error: "orderId or refCode is required" },
      { status: 400 }
    );
  }

  const intake = await db.paymentIntake.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!intake) {
    return NextResponse.json({ error: "Intake not found" }, { status: 404 });
  }
  if (intake.status !== "NEEDS_REVIEW") {
    return NextResponse.json(
      { error: `This deposit is already ${intake.status}` },
      { status: 400 }
    );
  }

  const order = await db.order.findFirst({
    where: {
      event: { organizationId: orgId },
      ...(orderId ? { id: orderId } : { refCode }),
    },
    include: { payments: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "Order is cancelled" }, { status: 400 });
  }

  const methodLabel = intake.method === "ZELLE" ? "Zelle" : "Interac";
  const payment = await recordPayment({
    orderId: order.id,
    orgId,
    userId,
    kind: "RECEIVED",
    amountCents: intake.amountCents,
    reason: `Staff linked · Payment bot · ${methodLabel} ${intake.externalId}`.slice(
      0,
      200
    ),
    method: intake.method,
  });

  let confirmed = false;
  if (order.status === "PENDING_PAYMENT") {
    const refreshed = await db.order.findFirst({
      where: { id: order.id },
      include: { payments: true },
    });
    if (
      refreshed &&
      summarizePayments(refreshed.payments, refreshed.totalCents).canConfirm
    ) {
      const result = await confirmPendingOrder({
        orderId: order.id,
        orgId,
        confirmedById: userId,
      });
      confirmed = result.ok;
    }
  }

  const updated = await db.paymentIntake.update({
    where: { id: intake.id },
    data: {
      status: "APPLIED",
      matchTier: "STAFF_LINK",
      orderId: order.id,
      paymentId: payment.id,
      confirmed,
      resolvedAt: new Date(),
      resolvedById: userId,
    },
  });

  return NextResponse.json({ intake: updated, payment, confirmed });
}
