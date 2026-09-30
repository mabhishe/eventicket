import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSession,
  setActiveOrgCookie,
  resolveActiveMembership,
} from "@/lib/auth";

/** List the orgs the signed-in user belongs to. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const memberships = await db.membership.findMany({
    where: { userId: session.userId },
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  const active = await resolveActiveMembership(session.userId);
  return NextResponse.json({
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
    activeOrgId: active?.organizationId || null,
  });
}

/** Switch the "working as" organization. Body: { orgId }. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const orgId = String(body.orgId || "");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: { userId: session.userId, organizationId: orgId },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }
  await setActiveOrgCookie(orgId);
  return NextResponse.json({ ok: true, orgId });
}
