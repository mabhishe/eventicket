import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, consumeVerificationToken } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

const LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

/** Set a new password with a single-use reset token (1h expiry). */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`reset:${clientIp(req)}`, LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const token = String(body.token || "");
  const password = String(body.password || "");
  if (!token || password.length < 8) {
    return NextResponse.json(
      { error: "A valid reset link and a password of 8+ characters are required" },
      { status: 400 }
    );
  }

  const userId = await consumeVerificationToken(token, "RESET_PASSWORD");
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired" },
      { status: 400 }
    );
  }
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  return NextResponse.json({ ok: true });
}
