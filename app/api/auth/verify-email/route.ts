import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeVerificationToken } from "@/lib/auth";

/** Consume an email-verification token (?token=). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const userId = await consumeVerificationToken(token, "VERIFY_EMAIL");
  if (!userId) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired" },
      { status: 400 }
    );
  }
  await db.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });
  return NextResponse.json({ ok: true });
}
