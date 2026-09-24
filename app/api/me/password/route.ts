import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser, verifyPassword, hashPassword } from "@/lib/auth";

/** Change your own password. */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req);
  if (!auth.ok) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { id: auth.user.id } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  return NextResponse.json({ ok: true });
}
