import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { orgHasPaymentAutoMatch } from "@/lib/paymentIntake";

/** List payment intakes (bot deposits), default NEEDS_REVIEW. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, paymentAutoMatchEnabled: true },
  });
  if (!org || !orgHasPaymentAutoMatch(org)) {
    return NextResponse.json({ intakes: [], available: false });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "NEEDS_REVIEW").trim();
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
  );

  const where = {
    organizationId: orgId,
    ...(status && status !== "ALL" ? { status } : {}),
  };

  const [intakes, needsReviewCount, appliedToday] = await Promise.all([
    db.paymentIntake.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.paymentIntake.count({
      where: { organizationId: orgId, status: "NEEDS_REVIEW" },
    }),
    db.paymentIntake.count({
      where: {
        organizationId: orgId,
        status: "APPLIED",
        createdAt: { gte: startOfLocalDay() },
      },
    }),
  ]);

  return NextResponse.json({
    available: true,
    intakes,
    needsReviewCount,
    appliedToday,
  });
}

function startOfLocalDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
