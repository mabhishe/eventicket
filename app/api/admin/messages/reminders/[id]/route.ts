import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";

const MANAGERS = ["ORG_OWNER", "ORG_ADMIN"] as const;
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, [...MANAGERS]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id } = await params;
  const reminder = await db.scheduledReminder.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!reminder) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }
  await db.scheduledReminder.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
