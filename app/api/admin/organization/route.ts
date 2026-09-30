import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";

const EDITABLE = [
  "name",
  "tagline",
  "supportEmail",
  "supportPhone",
  "timezone",
  "brandColor",
  "etransferEmail",
  "zelleHandle",
  "cashNote",
] as const;

/** Get the active organization's settings. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ organization: org });
}

/** Update the active organization's settings. */
export async function PATCH(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    const v = String(body[key] ?? "").trim();
    if (key === "name" && !v) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }
    if (key === "brandColor" && v && !/^#[0-9a-fA-F]{6}$/.test(v)) {
      return NextResponse.json(
        { error: "Brand color must be a hex code like #1a73e8" },
        { status: 400 }
      );
    }
    if (
      (key === "supportEmail" || key === "etransferEmail") &&
      v &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    ) {
      return NextResponse.json(
        { error: `That ${key === "supportEmail" ? "support" : "e-Transfer"} email doesn't look valid` },
        { status: 400 }
      );
    }
    data[key] = v || null;
  }

  const org = await db.organization.update({ where: { id: orgId }, data });
  return NextResponse.json({ organization: org });
}
