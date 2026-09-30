import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";

const MANAGERS = ["ORG_OWNER", "ORG_ADMIN"] as const;
const MAX_OFFSET_MINUTES = 30 * 24 * 60; // 30 days

/** List scheduled reminders for the org (upcoming events first). */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, [...MANAGERS]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const reminders = await db.scheduledReminder.findMany({
    where: { organizationId: orgId },
    include: { event: { select: { id: true, title: true, date: true, slug: true } } },
    orderBy: { event: { date: "asc" } },
  });
  return NextResponse.json({ reminders });
}

/** Add a scheduled reminder: N minutes before an event, via email/WhatsApp. */
export async function POST(req: NextRequest) {
  const auth = await requireOrgApiUser(req, [...MANAGERS]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = String(body?.eventId || "");
  const offsetMinutes = Math.floor(Number(body?.offsetMinutes));
  const channel = String(body?.channel || "");
  const event = eventId
    ? await db.event.findFirst({ where: { id: eventId, organizationId: orgId } })
    : null;
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!Number.isFinite(offsetMinutes) || offsetMinutes < 15 || offsetMinutes > MAX_OFFSET_MINUTES) {
    return NextResponse.json(
      { error: "offsetMinutes must be between 15 and 43200" },
      { status: 400 }
    );
  }
  if (!["EMAIL", "WHATSAPP"].includes(channel)) {
    return NextResponse.json({ error: "channel must be EMAIL or WHATSAPP" }, { status: 400 });
  }
  const reminder = await db.scheduledReminder.create({
    data: { organizationId: orgId, eventId: event.id, offsetMinutes, channel },
  });
  return NextResponse.json({ reminder }, { status: 201 });
}
