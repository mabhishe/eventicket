import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser, hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { soldOrders: true } },
    },
  });
  return NextResponse.json({ users });
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

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "");
  if (!name || !email || password.length < 8) {
    return NextResponse.json(
      { error: "Name, email and a password of 8+ characters are required" },
      { status: 400 }
    );
  }
  if (!["ADMIN", "SELLER", "DOOR"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: role as "ADMIN" | "SELLER" | "DOOR",
      },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create user (email may be taken)" },
      { status: 400 }
    );
  }
}
