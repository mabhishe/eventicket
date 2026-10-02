import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { summarizePayments } from "@/lib/money";

/** Door: search tickets by code, buyer name, or holder name within an event. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_DOOR"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  const q = (searchParams.get("q") || "").trim();
  if (!eventId || !q) {
    return NextResponse.json({ tickets: [] });
  }

  const digits = q.replace(/\D/g, "");
  const admittedOrder = {
    eventId,
    event: { organizationId: orgId },
    OR: [
      { status: "CONFIRMED" as const },
      { emergencyAdmittedAt: { not: null } },
    ],
  };
  const tickets = await db.ticket.findMany({
    where: {
      order: admittedOrder,
      status: { not: "CANCELLED" },
      OR: [
        { code: { contains: q.toUpperCase() } },
        { holderName: { contains: q } },
        { order: { buyerName: { contains: q } } },
        { order: { buyerEmail: { contains: q } } },
        { order: { buyerPhone: { contains: q } } },
        { order: { refCode: { contains: q.toUpperCase() } } },
        ...(digits.length >= 4
          ? [{ order: { buyerPhone: { contains: digits } } }]
          : []),
      ],
    },
    take: 25,
    orderBy: { createdAt: "asc" },
    include: {
      ticketType: { select: { name: true } },
      mealOption: { select: { name: true, tag: true } },
      order: { select: { buyerName: true } },
    },
  });
  const pending = await db.order.findMany({
    where: {
      eventId,
      status: "PENDING_PAYMENT",
      emergencyAdmittedAt: null,
      event: { organizationId: orgId },
      OR: [
        { buyerName: { contains: q } },
        { buyerEmail: { contains: q } },
        { buyerPhone: { contains: q } },
        { refCode: { contains: q.toUpperCase() } },
        { items: { some: { holderName: { contains: q } } } },
        ...(digits.length >= 4 ? [{ buyerPhone: { contains: digits } }] : []),
      ],
    },
    take: 15,
    orderBy: { createdAt: "desc" },
    include: {
      payments: true,
      event: { select: { currency: true } },
      items: { select: { holderName: true, qty: true } },
    },
  });

  return NextResponse.json({
    tickets,
    pendingOrders: pending.map((o) => {
      const sum = summarizePayments(o.payments, o.totalCents);
      return {
        id: o.id,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        buyerPhone: o.buyerPhone,
        refCode: o.refCode,
        totalCents: o.totalCents,
        currency: o.event.currency,
        receivedCents: sum.net,
        balanceCents: sum.balance,
        holders: o.items.map((i) => i.holderName).filter(Boolean),
      };
    }),
  });
}
