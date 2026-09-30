import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE_NAME = "session";

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string, role: string): Promise<void> {
  const token = await new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
  const store = await cookies();
  // The Secure flag must only be set when the app is served over HTTPS.
  // Basing it on NODE_ENV breaks logins when the production build is opened
  // over plain http:// on the local network (e.g. from a phone), because the
  // browser silently drops Secure cookies sent over http.
  const appUrl = process.env.APP_URL || "";
  const secure = appUrl
    ? appUrl.startsWith("https://")
    : process.env.NODE_ENV === "production";
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export type Session = { userId: string; role: string } | null;

export async function getSession(): Promise<Session> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: payload.userId as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

/** Use in Server Components / Server Actions. Redirects to /login when unauthorized. */
export async function requireUser(allowedRoles?: string[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    redirect("/login?error=forbidden");
  }
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");
  return user;
}

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * Use in API Route Handlers. Returns { user } or { error: NextResponse }.
 * Usage:
 *   const auth = await requireApiUser(req, ["ADMIN"]);
 *   if (auth.error) return auth.error;
 *   const { user } = auth;
 */
export async function requireApiUser(
  _req: NextRequest,
  allowedRoles?: string[]
): Promise<
  { ok: true; user: ApiUser } | { ok: false; error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

/* ------------------------------------------------------------------ */
/* Phase 1 (multi-tenant): organization-scoped authorization           */
/* ------------------------------------------------------------------ */

const ORG_COOKIE_NAME = "active_org";

/** Org-level roles, in decreasing privilege order. */
export const ORG_ROLES = ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF", "ORG_DOOR"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

function cookieFlags() {
  const appUrl = process.env.APP_URL || "";
  const secure = appUrl
    ? appUrl.startsWith("https://")
    : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure,
  };
}

export async function setActiveOrgCookie(orgId: string): Promise<void> {
  const store = await cookies();
  store.set(ORG_COOKIE_NAME, orgId, cookieFlags());
}

export async function clearActiveOrgCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ORG_COOKIE_NAME);
}

export async function getActiveOrgId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ORG_COOKIE_NAME)?.value || null;
}

export type OrgMembershipInfo = {
  membershipId: string;
  organizationId: string;
  role: OrgRole;
  orgName: string;
  orgSlug: string;
};

/**
 * Resolve which organization the user is "working as".
 * The active_org cookie wins when it names one of their orgs;
 * otherwise the oldest membership is used.
 *
 * NOTE: this never WRITES cookies — cookie writes are only legal in Route
 * Handlers / Server Actions (Next 16 throws otherwise), and this runs inside
 * Server Components too. The cookie is (re)written at login and by the
 * active-org switch endpoint.
 */
export async function resolveActiveMembership(
  userId: string
): Promise<OrgMembershipInfo | null> {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { organization: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return null;
  const cookieOrg = await getActiveOrgId();
  const match =
    (cookieOrg && memberships.find((m) => m.organizationId === cookieOrg)) ||
    memberships[0];
  return {
    membershipId: match.id,
    organizationId: match.organizationId,
    role: match.role as OrgRole,
    orgName: match.organization.name,
    orgSlug: match.organization.slug,
  };
}

export type OrgApiUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  orgId: string;
  orgRole: OrgRole;
  orgName: string;
};

/**
 * API-route guard: like requireApiUser, but scoped to the user's active
 * organization. Returns { user } with orgId/orgRole, or { error }.
 */
export async function requireOrgApiUser(
  _req: NextRequest,
  allowedOrgRoles?: OrgRole[]
): Promise<
  { ok: true; user: OrgApiUser } | { ok: false; error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  const membership = await resolveActiveMembership(session.userId);
  if (!membership) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "No organization — contact your administrator" },
        { status: 403 }
      ),
    };
  }
  if (allowedOrgRoles && !allowedOrgRoles.includes(membership.role)) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: membership.organizationId,
      orgRole: membership.role,
      orgName: membership.orgName,
    },
  };
}

/**
 * Server-component guard: like requireUser, but returns the active org
 * context. Redirects to /login when unauthorized.
 */
export async function requireOrgUser(allowedOrgRoles?: OrgRole[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  const membership = await resolveActiveMembership(session.userId);
  if (!membership) redirect("/login?error=no-org");
  if (allowedOrgRoles && !allowedOrgRoles.includes(membership.role)) {
    redirect("/login?error=forbidden");
  }
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");
  return {
    user,
    orgId: membership.organizationId,
    orgRole: membership.role,
    orgName: membership.orgName,
    orgSlug: membership.orgSlug,
  };
}

/**
 * Load an event only if it belongs to the given org.
 * Use in every org-scoped route that takes an event id — a cross-org id
 * returns null (callers map it to 404) so orgs can never see each other.
 */
export async function getOrgEvent(orgId: string, eventId: string) {
  return db.event.findFirst({
    where: { id: eventId, organizationId: orgId },
  });
}

/**
 * Load an event by slug only if it belongs to the given org.
 */
export async function getOrgEventBySlug(orgId: string, slug: string) {
  return db.event.findFirst({
    where: { slug, organizationId: orgId },
  });
}

/* ------------------------------------------------------------------ */
/* Phase 2 (self-serve): email verification + password reset tokens   */
/* ------------------------------------------------------------------ */

import crypto from "crypto";

const VERIFY_EMAIL_TTL_HOURS = 24;
const RESET_PASSWORD_TTL_HOURS = 1;

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export type VerificationTokenType = "VERIFY_EMAIL" | "RESET_PASSWORD";

/**
 * Create a single-use token for email verification or password reset.
 * Returns the RAW token (sent to the user); only its sha256 is stored.
 */
export async function createVerificationToken(
  userId: string,
  type: VerificationTokenType
): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const ttlHours =
    type === "VERIFY_EMAIL" ? VERIFY_EMAIL_TTL_HOURS : RESET_PASSWORD_TTL_HOURS;
  // Invalidate older unused tokens of the same type so only the newest works.
  await db.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  await db.verificationToken.create({
    data: {
      userId,
      tokenHash: sha256(raw),
      type,
      expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
    },
  });
  return raw;
}

/**
 * Consume a token: returns the userId when the token is valid, unused and
 * unexpired, and marks it used. Returns null otherwise (no information leak
 * about which check failed).
 */
export async function consumeVerificationToken(
  rawToken: string,
  type: VerificationTokenType
): Promise<string | null> {
  const token = await db.verificationToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
  });
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }
  await db.verificationToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });
  return token.userId;
}
