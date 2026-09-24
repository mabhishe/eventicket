import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

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
  const auth = await requireApiUser(req, ["ADMIN", "SELLER"]);
  if (!auth.ok) return auth.error;

  const events = await db.event.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: { select: { orders: true, ticketTypes: true } },
      createdBy: { select: { name: true } },
    },
  });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;

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
  const dateRaw = String(body.date || "");
  const date = new Date(dateRaw);
  if (isNaN(date.getTime())) {
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
      venue: String(body.venue || "").trim() || null,
      currency: String(body.currency || "CAD").trim() || "CAD",
      etransferEmail: String(body.etransferEmail || "").trim() || null,
      zelleHandle: String(body.zelleHandle || "").trim() || null,
      cashNote: String(body.cashNote || "").trim() || null,
      requireEntryBeforeFood: body.requireEntryBeforeFood === true,
      createdById: auth.user.id,
    },
  });
  return NextResponse.json({ event }, { status: 201 });
}
