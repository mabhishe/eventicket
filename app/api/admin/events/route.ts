import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { eventTimeZone, parseEventInstant } from "@/lib/datetime";

function slugify(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "event";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const events = await db.event.findMany({
    where: { organizationId: orgId },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { orders: true, ticketTypes: true } },
      createdBy: { select: { name: true } },
    },
  });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  const timezone = eventTimeZone(
    typeof body.timezone === "string" ? body.timezone : org?.timezone
  );
  const date = parseEventInstant(String(body.date || ""), timezone);
  if (!date) {
    return NextResponse.json(
      { error: "A valid event date/time is required" },
      { status: 400 }
    );
  }

  const event = await db.event.create({
    data: {
      title,
      slug: slugify(title),
      description: String(body.description || "").trim() || null,
      date,
      timezone,
      venue: String(body.venue || "").trim() || null,
      currency: String(body.currency || "CAD").trim() || "CAD",
      etransferEmail: String(body.etransferEmail || "").trim() || null,
      zelleHandle: String(body.zelleHandle || "").trim() || null,
      cashNote: String(body.cashNote || "").trim() || null,
      requireEntryBeforeFood: body.requireEntryBeforeFood === true,
      organizationId: orgId,
      createdById: auth.user.id,
    },
  });
  return NextResponse.json({ event }, { status: 201 });
}
