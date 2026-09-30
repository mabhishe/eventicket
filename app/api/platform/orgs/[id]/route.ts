import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform";

async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session) return false;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  return isPlatformAdmin(user?.email);
}

type Ctx = { params: Promise<{ id: string }> };

function parseOverride(v: unknown): number | null | undefined {
  // undefined = not sent (leave unchanged); null/"" = clear override
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return undefined; // invalid -> ignore
  return n;
}

/**
 * Update an org's plan or limit overrides. Platform admins only.
 * Body: { plan?: "FREE"|"PRO", maxEventsOverride?, maxTicketsOverride?, maxSeatsOverride? }
 * Overrides accept a non-negative integer, or null/"" to clear back to the plan default.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await requirePlatformAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: {
    plan?: string;
    maxEventsOverride?: number | null;
    maxTicketsOverride?: number | null;
    maxSeatsOverride?: number | null;
  } = {};
  if (body.plan !== undefined) {
    if (body.plan !== "FREE" && body.plan !== "PRO") {
      return NextResponse.json({ error: "plan must be FREE or PRO" }, { status: 400 });
    }
    data.plan = body.plan;
  }
  const me = parseOverride(body.maxEventsOverride);
  const mt = parseOverride(body.maxTicketsOverride);
  const ms = parseOverride(body.maxSeatsOverride);
  if (me !== undefined) data.maxEventsOverride = me;
  if (mt !== undefined) data.maxTicketsOverride = mt;
  if (ms !== undefined) data.maxSeatsOverride = ms;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  try {
    const org = await db.organization.update({ where: { id }, data });
    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        plan: org.plan,
        maxEventsOverride: org.maxEventsOverride,
        maxTicketsOverride: org.maxTicketsOverride,
        maxSeatsOverride: org.maxSeatsOverride,
      },
    });
  } catch {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
}
