import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  createSession,
  resolveActiveMembership,
  createVerificationToken,
} from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { sendEmail, verifyEmailHtml, appUrl } from "@/lib/email";
import { publicSignupEnabled } from "@/lib/publicSignup";

// Abuse protection: 5 signups per hour per IP.
const SIGNUP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Public signup: creates the user, their organization, and an ORG_OWNER
 * membership, then starts a session. Sends a verification email when email
 * is configured; otherwise the address is auto-verified (self-hosted mode).
 */
export async function POST(req: NextRequest) {
  if (!publicSignupEnabled()) {
    return NextResponse.json(
      {
        error:
          "Public signup is turned off. Ask an organizer to add you from Team.",
      },
      { status: 403 }
    );
  }
  const rl = checkRateLimit(`signup:${clientIp(req)}`, SIGNUP_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many signups. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const orgName = String(body.orgName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!name || !orgName || !email || password.length < 8) {
    return NextResponse.json(
      { error: "Name, organization, email and a password of 8+ characters are required" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email doesn't look valid" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Same message as success would give — don't reveal registered emails.
    return NextResponse.json(
      { error: "If this email is already registered, try signing in instead." },
      { status: 400 }
    );
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "SELLER",
      emailVerified: false,
    },
  });
  const org = await db.organization.create({
    data: { name: orgName, slug: slugify(orgName) },
  });
  await db.membership.create({
    data: { userId: user.id, organizationId: org.id, role: "ORG_OWNER" },
  });

  // Email verification (skipped gracefully when email isn't configured).
  const token = await createVerificationToken(user.id, "VERIFY_EMAIL");
  const base = appUrl();
  const sent = base
    ? await sendEmail({
        to: email,
        subject: "Verify your email",
        html: verifyEmailHtml(name, `${base}/verify-email?token=${token}`),
      })
    : false;
  if (!sent) {
    console.warn("[auth] verification email skipped — auto-verifying (email not configured)");
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }

  await createSession(user.id, user.role, {
    orgRole: "ORG_OWNER",
    sessionVersion: 0,
  });
  const membership = await resolveActiveMembership(user.id);
  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        orgId: membership?.organizationId || org.id,
        orgRole: "ORG_OWNER",
        orgName: org.name,
        emailVerified: sent ? false : true,
      },
    },
    { status: 201 }
  );
}
