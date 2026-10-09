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

const METRICS = [
  "MONTHLY_BOOKINGS",
  "MONTHLY_EMAILS",
  "MONTHLY_WHATSAPP",
  "MAX_EVENTS",
  "MAX_SEATS",
] as const;

function serialize(o: {
  id: string;
  metric: string;
  value: number;
  reason: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}) {
  const now = new Date();
  const active =
    o.revokedAt == null && o.createdAt <= now && now < o.expiresAt;
  const expiringSoon =
    active && o.expiresAt.getTime() - now.getTime() < 7 * 24 * 3600 * 1000;
  return {
    id: o.id,
    metric: o.metric,
    value: o.value,
    reason: o.reason,
    createdBy: o.createdBy,
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    revokedAt: o.revokedAt?.toISOString() ?? null,
    status: o.revokedAt != null ? "revoked" : active ? "active" : "expired",
    expiringSoon,
  };
}

/**
 * List an org's temporary quota overrides: active first, then history.
 * Platform admins only. Invisible to the organization itself.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await requirePlatformAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const org = await db.organization.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const rows = await db.organizationQuotaOverride.findMany({
    where: { organizationId: id },
    orderBy: [{ revokedAt: "asc" }, { expiresAt: "desc" }],
  });
  const items = rows.map(serialize);
  items.sort((a, b) => {
    const rank = (s: string) =>
      s === "active" ? 0 : s === "expired" ? 1 : 2;
    return rank(a.status) - rank(b.status);
  });
  return NextResponse.json({ overrides: items });
}

/**
 * Grant a temporary quota override. Platform admins only.
 * Body: { metric, value, expiresAt (ISO), reason }
 * - metric must be a known QuotaMetric
 * - value must be a non-negative integer
 * - reason is required (audit)
 * - expiresAt is required and must be in the future
 * Warns (does not reject) when value <= the plan default — a no-op grant.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await requirePlatformAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const org = await db.organization.findUnique({
    where: { id },
    select: { id: true, plan: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!(METRICS as readonly string[]).includes(String(body.metric))) {
    return NextResponse.json(
      { error: `metric must be one of: ${METRICS.join(", ")}` },
      { status: 400 }
    );
  }
  const value = Number(body.value);
  if (!Number.isInteger(value) || value < 0) {
    return NextResponse.json(
      { error: "value must be a non-negative integer" },
      { status: 400 }
    );
  }
  const reason = String(body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json(
      { error: "reason is required — say why this override was granted" },
      { status: 400 }
    );
  }
  const expiresAt = new Date(String(body.expiresAt ?? ""));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    return NextResponse.json(
      { error: "expiresAt is required and must be in the future" },
      { status: 400 }
    );
  }

  const session = await getSession();
  const user = session
    ? await db.user.findUnique({
        where: { id: session.userId },
        select: { email: true },
      })
    : null;

  const created = await db.organizationQuotaOverride.create({
    data: {
      organizationId: id,
      metric: body.metric as (typeof METRICS)[number],
      value,
      reason,
      createdBy: user?.email ?? "unknown",
      expiresAt,
    },
  });

  // Warn when the grant changes nothing vs the plan default.
  const planDefaults: Record<string, number | null> = {
    MAX_EVENTS: org.plan === "PRO" ? null : 1,
    MAX_SEATS: org.plan === "PRO" ? null : 2,
    MONTHLY_BOOKINGS: 200,
    MONTHLY_EMAILS: 400,
    MONTHLY_WHATSAPP: 1000,
  };
  const def = planDefaults[String(body.metric)];
  const warning =
    def != null && value <= def
      ? `Heads up: ${value} is at or below the ${org.plan} plan default (${def}) — this grant changes nothing.`
      : null;

  return NextResponse.json(
    { override: serialize(created), warning },
    { status: 201 }
  );
}
