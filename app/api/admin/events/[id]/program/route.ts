import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

const orderBy = [{ sortOrder: "asc" }, { createdAt: "asc" }] as const;

/** Admin: list program/schedule items for an event. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(_req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;
  const items = await db.programItem.findMany({
    where: { eventId: id },
    orderBy: [...orderBy],
  });
  return NextResponse.json({ items });
}

/** Admin: add a program/schedule item. Body: { timeLabel, title, description? } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const timeLabel = String(body.timeLabel || "").trim();
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim() || null;
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const count = await db.programItem.count({ where: { eventId: id } });
  const item = await db.programItem.create({
    data: { eventId: id, timeLabel, title, description, sortOrder: count },
  });
  return NextResponse.json({ item }, { status: 201 });
}
