import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

async function getItem(id: string, itemId: string) {
  return db.programItem.findFirst({ where: { id: itemId, eventId: id } });
}

/** Admin: edit a program item, or move it (body: { move: "up" | "down" }). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id, itemId } = await params;
  const item = await getItem(id, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (body.move === "up" || body.move === "down") {
    const items = await db.programItem.findMany({
      where: { eventId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const idx = items.findIndex((i) => i.id === itemId);
    const swapIdx = body.move === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) {
      return NextResponse.json({ items });
    }
    const [a, b] = [items[idx], items[swapIdx]];
    await db.$transaction([
      db.programItem.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
      db.programItem.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
    ]);
    const refreshed = await db.programItem.findMany({
      where: { eventId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ items: refreshed });
  }

  const data: Record<string, string | null> = {};
  if (body.timeLabel !== undefined) data.timeLabel = String(body.timeLabel || "").trim();
  if (body.title !== undefined) {
    const t = String(body.title || "").trim();
    if (!t) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    data.title = t;
  }
  if (body.description !== undefined)
    data.description = String(body.description || "").trim() || null;
  const updated = await db.programItem.update({ where: { id: itemId }, data });
  return NextResponse.json({ item: updated });
}

/** Admin: delete a program item. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id, itemId } = await params;
  const item = await getItem(id, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.programItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
