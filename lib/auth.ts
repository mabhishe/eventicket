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
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
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
