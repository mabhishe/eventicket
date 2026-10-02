import { db } from "./db";
import { summarizePayments } from "./money";

export type PaymentKindInput = "RECEIVED" | "REFUND" | "WAIVER";

/**
 * Append one ledger row. Received money is what unlocks Confirm.
 * A refund returns money already recorded. A waiver forgives unpaid
 * balance and is stored for the audit; it does not unlock Confirm.
 */
export async function recordPayment(opts: {
  orderId: string;
  orgId: string;
  userId: string;
  kind: PaymentKindInput;
  amountCents: number;
  reason?: string | null;
  method?: string | null;
}) {
  if (!Number.isInteger(opts.amountCents) || opts.amountCents <= 0) {
    throw new Error("Enter an amount greater than zero");
  }
  if (opts.amountCents > 2_000_000) throw new Error("Amount is too large");

  const order = await db.order.findFirst({
    where: { id: opts.orderId, event: { organizationId: opts.orgId } },
    include: { payments: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.status === "CANCELLED") throw new Error("Order is cancelled");

  const sum = summarizePayments(order.payments, order.totalCents);
  const reason = opts.reason?.trim() || "";

  if (opts.kind === "RECEIVED") {
    return db.payment.create({
      data: {
        orderId: order.id,
        kind: "RECEIVED",
        amountCents: opts.amountCents,
        method: (opts.method || order.payMethod || "ETRANSFER").trim(),
        reason: reason || null,
        recordedById: opts.userId,
      },
    });
  }

  if (reason.length < 3) throw new Error("A reason is required");

  if (opts.kind === "REFUND") {
    const refundable = sum.received - sum.refunded;
    if (opts.amountCents > refundable) {
      throw new Error("Refund is larger than the money recorded on this order");
    }
  } else {
    const waiveable = Math.max(0, order.totalCents - sum.net - sum.waived);
    if (waiveable <= 0) throw new Error("There is no unpaid balance to waive");
    if (opts.amountCents > waiveable) {
      throw new Error("Waiver is larger than the unpaid balance");
    }
  }

  return db.payment.create({
    data: {
      orderId: order.id,
      kind: opts.kind,
      amountCents: opts.amountCents,
      method: null,
      reason,
      recordedById: opts.userId,
    },
  });
}
