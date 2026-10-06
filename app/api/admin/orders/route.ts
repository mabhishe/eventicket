import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";

/** List orders, optionally filtered by event and/or status. Paginated. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50)
  );
  const q = (searchParams.get("q") || "").trim();
  const digits = q.replace(/\D/g, "");

  const where = {
    event: { organizationId: orgId },
    ...(eventId ? { eventId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { buyerName: { contains: q } },
            { buyerEmail: { contains: q } },
            { buyerPhone: { contains: q } },
            { refCode: { contains: q.toUpperCase() } },
            { items: { some: { holderName: { contains: q } } } },
            ...(digits.length >= 4
              ? [{ buyerPhone: { contains: digits } }]
              : []),
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        event: { select: { title: true, currency: true, timezone: true } },
        seller: { select: { name: true } },
        confirmedBy: { select: { name: true } },
        emergencyAdmittedBy: { select: { name: true } },
        payments: {
          orderBy: { createdAt: "asc" },
          include: { recordedBy: { select: { name: true } } },
        },
        items: { include: { ticketType: true, mealOption: true } },
        _count: { select: { tickets: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return NextResponse.json({ orders, page, pageSize, total });
}
