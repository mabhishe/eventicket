import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, createVerificationToken } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { sendEmail, verifyEmailHtml, appUrl } from "@/lib/email";

const RESEND_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

/**
 * Re-send the logged-in user's email-verification link.
 * Rate-limited per IP. Returns ok:true when the user is already verified
 * (nothing to do) so the button simply clears the banner.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`resend-verify:${clientIp(req)}`, RESEND_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  const token = await createVerificationToken(user.id, "VERIFY_EMAIL");
  const base = appUrl();
  const sent = base
    ? await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: verifyEmailHtml(user.name, `${base}/verify-email?token=${token}`),
      })
    : false;

  if (!sent) {
    return NextResponse.json(
      {
        error:
          "Couldn't send the email. The server's email sending isn't configured or the send failed — check the server logs.",
      },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
