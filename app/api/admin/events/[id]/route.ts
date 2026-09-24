import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN", "SELLER"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  const event = await db.event.findUnique({
    where: { id },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      mealOptions: { orderBy: { sortOrder: "asc" } },
      _count: { select: { orders: true } },
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ event });
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
] as const;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
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
    const event = await db.event.update({ where: { id }, data });
    return NextResponse.json({ event });
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}
