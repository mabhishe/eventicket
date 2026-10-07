import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { orgHasPaymentAutoMatch } from "@/lib/paymentIntake";

type Ctx = { params: Promise<{ id: string }> };

/** Staff dismisses a NEEDS_REVIEW intake (not our payment / duplicate noise). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId, id: userId } = auth.user;
  const { id } = await params;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, paymentAutoMatchEnabled: true },
  });
  if (!org || !orgHasPaymentAutoMatch(org)) {
    return NextResponse.json({ error: "Payment auto-match is not enabled" }, { status: 403 });
  }

  const intake = await db.paymentIntake.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!intake) {
    return NextResponse.json({ error: "Intake not found" }, { status: 404 });
  }
  if (intake.status !== "NEEDS_REVIEW") {
    return NextResponse.json(
      { error: `This deposit is already ${intake.status}` },
      { status: 400 }
    );
  }

  const updated = await db.paymentIntake.update({
    where: { id: intake.id },
    data: {
      status: "IGNORED",
      resolvedAt: new Date(),
      resolvedById: userId,
    },
  });

  return NextResponse.json({ intake: updated });
}
