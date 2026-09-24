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
  const priceCents = Math.round(Number(body.priceCents));
  const quantityTotal = Math.round(Number(body.quantityTotal));
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }
  if (!Number.isInteger(quantityTotal) || quantityTotal <= 0) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const count = await db.ticketType.count({ where: { eventId: id } });
  const ticketType = await db.ticketType.create({
    data: {
      eventId: id,
      name,
      description: String(body.description || "").trim() || null,
      priceCents,
      quantityTotal,
      includesMeal: body.includesMeal === true,
      sortOrder: count,
    },
  });
  return NextResponse.json({ ticketType }, { status: 201 });
}
