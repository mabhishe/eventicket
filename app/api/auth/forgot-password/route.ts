import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  consumeVerificationToken,
} from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { sendEmail, resetPasswordHtml, appUrl } from "@/lib/email";
import { createVerificationToken } from "@/lib/auth";

// Abuse protection on both endpoints: 5 per hour per IP.
const LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

/**
 * Request a password reset. Always returns ok — never reveals whether the
 * email is registered.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`forgot:${clientIp(req)}`, LIMIT);
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
    return NextResponse.json({ ok: true });
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (email) {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const token = await createVerificationToken(user.id, "RESET_PASSWORD");
      const base = appUrl();
      if (base) {
        await sendEmail({
          to: email,
          subject: "Reset your password",
          html: resetPasswordHtml(
            user.name,
            `${base}/reset-password?token=${token}`
          ),
        });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
