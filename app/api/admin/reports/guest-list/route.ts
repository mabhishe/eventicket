import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { formatCents, summarizePayments } from "@/lib/money";

/** ADMIN: download the guest list for an event as CSV. */
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

  const tickets = await db.ticket.findMany({
    where: {
      status: { not: "CANCELLED" },
      order: {
        eventId,
        OR: [{ status: "CONFIRMED" }, { emergencyAdmittedAt: { not: null } }],
      },
    },
    orderBy: [{ ticketType: { sortOrder: "asc" } }, { createdAt: "asc" }],
    include: {
      ticketType: { select: { name: true } },
      mealOption: { select: { name: true, tag: true } },
      order: {
        select: {
          buyerName: true,
          buyerEmail: true,
          buyerPhone: true,
          refCode: true,
          payMethod: true,
          totalCents: true,
          status: true,
          emergencyAdmittedAt: true,
          emergencyAdmitReason: true,
          emergencyName: true,
          emergencyPhone: true,
          emergencyRelation: true,
          pickupAuth: true,
          waiverAcceptedAt: true,
          waiverSignedName: true,
          payments: { select: { kind: true, amountCents: true } },
        },
      },
    },
  });

  const rows: (string | number | null | undefined)[][] = [
    [
      "Holder name",
      "Ticket type",
      "Meal",
      "Diet",
      "Checked in",
      "Check-in time",
      "Food collected",
      "Food time",
      "Buyer name",
      "Buyer email",
      "Buyer phone",
      "Ticket code",
      "Order ref",
      "Pay method",
      "Order total",
      "Received",
      "Balance owing",
      "Order status",
      "Emergency reason",
      "Medical notes",
      "Emergency contact",
      "Emergency phone",
      "Emergency relation",
      "Pickup authorization",
      "Waiver accepted",
      "Waiver signed by",
    ],
  ];
  for (const t of tickets) {
    const sum = summarizePayments(t.order.payments, t.order.totalCents);
    rows.push([
      t.holderName || "",
      t.ticketType.name,
      t.mealOption?.name || "",
      t.mealOption?.tag === "veg"
        ? "veg"
        : t.mealOption?.tag === "nonveg"
          ? "non-veg"
          : "",
      t.status === "CHECKED_IN" ? "yes" : "no",
      t.checkedInAt ? new Date(t.checkedInAt).toISOString() : "",
      t.foodCollectedAt ? "yes" : "no",
      t.foodCollectedAt ? new Date(t.foodCollectedAt).toISOString() : "",
      t.order.buyerName,
      t.order.buyerEmail || "",
      t.order.buyerPhone || "",
      t.code,
      t.order.refCode || "",
      t.order.payMethod,
      formatCents(t.order.totalCents, event.currency),
      formatCents(sum.net, event.currency),
      formatCents(sum.balance, event.currency),
      t.order.emergencyAdmittedAt && t.order.status !== "CONFIRMED"
        ? "EMERGENCY"
        : t.order.status,
      t.order.emergencyAdmitReason || "",
      t.medicalNotes || "",
      t.order.emergencyName || "",
      t.order.emergencyPhone || "",
      t.order.emergencyRelation || "",
      t.order.pickupAuth || "",
      t.order.waiverAcceptedAt
        ? new Date(t.order.waiverAcceptedAt).toISOString()
        : "",
      t.order.waiverSignedName || "",
    ]);
  }

  return csvResponse(`${event.slug}-guests.csv`, rows);
}
