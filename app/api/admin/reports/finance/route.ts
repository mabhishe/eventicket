import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { formatCents, summarizePayments } from "@/lib/money";

/** ADMIN: download the per-order finance report for an event as CSV. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }
  const event = await db.event.findFirst({
    where: { id: eventId, organizationId: orgId },
  });
  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  const orders = await db.order.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    include: {
      items: { include: { ticketType: { select: { name: true } } } },
      payments: {
        orderBy: { createdAt: "asc" },
        include: { recordedBy: { select: { name: true } } },
      },
      confirmedBy: { select: { name: true } },
      emergencyAdmittedBy: { select: { name: true } },
    },
  });

  const rows: (string | number | null | undefined)[][] = [
    [
      "Order ref",
      "Buyer name",
      "Buyer email",
      "Buyer phone",
      "Items",
      "Ticket count",
      "Total due",
      "Received",
      "Refunded",
      "Waived",
      "Balance owing",
      "Pay method",
      "Status",
      "Emergency reason",
      "Emergency by",
      "Confirmed at",
      "Confirmed by",
      "Ledger",
      "Created at",
    ],
  ];
  for (const o of orders) {
    const ticketCount = o.items.reduce((s, i) => s + i.qty, 0);
    const sum = summarizePayments(o.payments, o.totalCents);
    const ledger = o.payments
      .map((p) => {
        const who = p.recordedBy?.name ? ` by ${p.recordedBy.name}` : "";
        const why = p.reason ? ` (${p.reason})` : "";
        return `${p.kind} ${formatCents(p.amountCents, event.currency)}${why}${who}`;
      })
      .join(" | ");
    rows.push([
      o.refCode || "",
      o.buyerName,
      o.buyerEmail || "",
      o.buyerPhone || "",
      o.items.map((i) => `${i.qty} × ${i.ticketType.name}`).join("; "),
      ticketCount,
      formatCents(o.totalCents, event.currency),
      formatCents(sum.net, event.currency),
      formatCents(sum.refunded, event.currency),
      formatCents(sum.waived, event.currency),
      formatCents(Math.max(0, o.totalCents - sum.net - sum.waived), event.currency),
      o.payMethod,
      o.emergencyAdmittedAt && o.status !== "CONFIRMED" ? "EMERGENCY" : o.status,
      o.emergencyAdmitReason || "",
      o.emergencyAdmittedBy?.name || "",
      o.confirmedAt ? new Date(o.confirmedAt).toISOString() : "",
      o.confirmedBy?.name || "",
      ledger,
      new Date(o.createdAt).toISOString(),
    ]);
  }

  return csvResponse(`${event.slug}-finance.csv`, rows);
}
