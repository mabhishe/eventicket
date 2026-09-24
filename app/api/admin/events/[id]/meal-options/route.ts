import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const rawTag = String(body.tag || "").trim();
  const tag = rawTag === "veg" || rawTag === "nonveg" ? rawTag : null;

  const count = await db.mealOption.count({ where: { eventId: id } });
  const mealOption = await db.mealOption.create({
    data: { eventId: id, name, tag, sortOrder: count },
  });
  return NextResponse.json({ mealOption }, { status: 201 });
}
