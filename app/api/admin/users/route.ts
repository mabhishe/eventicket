import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireOrgApiUser,
  hashPassword,
  ORG_ROLES,
  createVerificationToken,
} from "@/lib/auth";
import { sendEmail, verifyEmailHtml, appUrl } from "@/lib/email";

/** List team members (memberships) of the active organization. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const memberships = await db.membership.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: { select: { soldOrders: true } },
        },
      },
    },
  });
  const users = memberships.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    createdAt: m.createdAt,
    _count: m.user._count,
  }));
  return NextResponse.json({ users });
}

/**
 * Add someone to the team: creates a new login when the email is unknown,
 * otherwise attaches the existing user to this organization.
 * Body: { name, email, password?, role } — role is an ORG_* role.
 * Only an ORG_OWNER may grant ORG_OWNER.
 */
export async function POST(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId, orgRole } = auth.user;

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
  if (!name || !email || !(ORG_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { error: "Name, email and a valid role are required" },
      { status: 400 }
    );
  }
  if (role === "ORG_OWNER" && orgRole !== "ORG_OWNER") {
    return NextResponse.json(
      { error: "Only an owner can add another owner" },
      { status: 403 }
    );
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await db.membership.findUnique({
      where: {
        userId_organizationId: { userId: existingUser.id, organizationId: orgId },
      },
    });
    if (existingMembership) {
      return NextResponse.json(
        { error: "This person is already on the team" },
        { status: 400 }
      );
    }
    if (name && name !== existingUser.name) {
      await db.user.update({ where: { id: existingUser.id }, data: { name } });
    }
    const membership = await db.membership.create({
      data: {
        userId: existingUser.id,
        organizationId: orgId,
        role: role as (typeof ORG_ROLES)[number],
      },
    });
    return NextResponse.json(
      {
        user: {
          id: membership.id,
          userId: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: membership.role,
        },
      },
      { status: 201 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "A password of 8+ characters is required for a new login" },
      { status: 400 }
    );
  }
  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: "SELLER",
        memberships: {
          create: {
            organizationId: orgId,
            role: role as (typeof ORG_ROLES)[number],
          },
        },
      },
      select: { id: true, name: true, email: true },
    });
    // New team members verify their email like self-serve signups do.
    const inviteToken = await createVerificationToken(user.id, "VERIFY_EMAIL");
    const base = appUrl();
    const inviteSent = base
      ? await sendEmail({
          to: email,
          subject: "Verify your email",
          html: verifyEmailHtml(name, `${base}/verify-email?token=${inviteToken}`),
        })
      : false;
    if (!inviteSent) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }
    return NextResponse.json(
      {
        user: {
          id: user.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          role,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not create user (email may be taken)" },
      { status: 400 }
    );
  }
}
