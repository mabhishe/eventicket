import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id } = await params;

  const event = await db.event.findFirst({
    where: { id, organizationId: orgId },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      mealOptions: { orderBy: { sortOrder: "asc" } },
      programItems: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      _count: { select: { orders: true } },
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  // Top inviters: orders that brought in other buyers via ?invite= links.
  const referred = await db.order.groupBy({
    by: ["invitedBy"],
    where: { eventId: id, invitedBy: { not: null } },
    _count: { invitedBy: true },
    orderBy: { _count: { invitedBy: "desc" } },
    take: 10,
  });
  const inviterIds = referred.map((r) => r.invitedBy as string);
  const inviters = await db.order.findMany({
    where: { eventId: id, inviteCode: { in: inviterIds } },
    select: { inviteCode: true, buyerName: true },
  });
  const inviterName = new Map(
    inviters.map((o) => [o.inviteCode as string, o.buyerName])
  );
  const topInviters = referred.map((r) => ({
    name: inviterName.get(r.invitedBy as string) || "Unknown",
    inviteCode: r.invitedBy,
    joins: r._count.invitedBy,
  }));
  const wallCount = await db.order.count({
    where: { eventId: id, status: "CONFIRMED", showOnWall: true },
  });
  return NextResponse.json({ event, topInviters, wallCount });
}

const EDITABLE = [
  "title",
  "description",
  "date",
  "venue",
  "currency",
  "status",
  "etransferEmail",
  "zelleHandle",
  "cashNote",
  "brandColor",
  "requireEntryBeforeFood",
] as const;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    const v = body[key];
    if (key === "requireEntryBeforeFood") {
      data.requireEntryBeforeFood = v === true;
      continue;
    }
    if (key === "date") {
      const d = new Date(String(v));
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      data.date = d;
    } else if (key === "status") {
      if (!["DRAFT", "PUBLISHED", "CLOSED"].includes(String(v))) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = String(v);
    } else if (key === "brandColor") {
      const c = String(v ?? "").trim();
      if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) {
        return NextResponse.json(
          { error: "Brand color must be a hex code like #1a73e8" },
          { status: 400 }
        );
      }
      data.brandColor = c || null;
    } else {
      data[key] = String(v ?? "").trim() || null;
    }
  }
  if ("title" in data && !data.title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const existing = await db.event.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    // Phase 2: only verified organizers may publish events.
    if (data.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      const me = await db.user.findUnique({
        where: { id: auth.user.id },
        select: { emailVerified: true },
      });
      if (!me?.emailVerified) {
        return NextResponse.json(
          { error: "Verify your email before publishing events" },
          { status: 403 }
        );
      }
    }
    const event = await db.event.update({ where: { id }, data });
    return NextResponse.json({ event });
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}
