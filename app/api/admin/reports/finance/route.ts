import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { formatCents } from "@/lib/money";

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
    include: { items: { include: { ticketType: { select: { name: true } } } } },
  });

  const rows: (string | number | null | undefined)[][] = [
    [
      "Order ref",
      "Buyer name",
      "Buyer email",
      "Buyer phone",
      "Items",
      "Ticket count",
      "Total",
      "Pay method",
      "Status",
      "Created at",
    ],
  ];
  for (const o of orders) {
    const ticketCount = o.items.reduce((s, i) => s + i.qty, 0);
    rows.push([
      o.refCode || "",
      o.buyerName,
      o.buyerEmail || "",
      o.buyerPhone || "",
      o.items.map((i) => `${i.qty} × ${i.ticketType.name}`).join("; "),
      ticketCount,
      formatCents(o.totalCents, event.currency),
      o.payMethod,
      o.status,
      new Date(o.createdAt).toISOString(),
    ]);
  }

  return csvResponse(`${event.slug}-finance.csv`, rows);
}
