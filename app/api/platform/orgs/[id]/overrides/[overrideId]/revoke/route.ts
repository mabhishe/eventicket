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

type Ctx = { params: Promise<{ id: string; overrideId: string }> };

/**
 * Revoke a temporary quota override early. Sets revokedAt — the row is kept
 * for audit history, never deleted. Platform admins only. Idempotent.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  if (!(await requirePlatformAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, overrideId } = await params;
  const row = await db.organizationQuotaOverride.findFirst({
    where: { id: overrideId, organizationId: id },
  });
  if (!row) {
    return NextResponse.json({ error: "Override not found" }, { status: 404 });
  }
  if (row.revokedAt == null) {
    await db.organizationQuotaOverride.update({
      where: { id: overrideId },
      data: { revokedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
