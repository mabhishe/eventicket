import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import {
  generateWebhookSecret,
  orgHasPaymentAutoMatch,
} from "@/lib/paymentIntake";

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

function publicOrg(org: {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  timezone: string;
  brandColor: string | null;
  etransferEmail: string | null;
  zelleHandle: string | null;
  cashNote: string | null;
  plan: string;
  paymentAutoMatchEnabled: boolean;
  paymentWebhookSecretHash: string | null;
}) {
  const autoMatch = orgHasPaymentAutoMatch(org);
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    tagline: org.tagline,
    supportEmail: org.supportEmail,
    supportPhone: org.supportPhone,
    timezone: org.timezone,
    brandColor: org.brandColor,
    etransferEmail: org.etransferEmail,
    zelleHandle: org.zelleHandle,
    cashNote: org.cashNote,
    plan: org.plan,
    paymentAutoMatchEnabled: org.paymentAutoMatchEnabled,
    paymentAutoMatchAvailable: autoMatch,
    paymentWebhookConfigured: !!org.paymentWebhookSecretHash,
  };
}

/** Get the active organization's settings. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ organization: publicOrg(org) });
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

  // Rotate payment webhook secret (owners/admins when auto-match is available).
  if (body.rotatePaymentWebhookSecret === true) {
    const current = await db.organization.findUnique({ where: { id: orgId } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!orgHasPaymentAutoMatch(current)) {
      return NextResponse.json(
        { error: "Payment auto-match is not enabled for this organization" },
        { status: 403 }
      );
    }
    const { raw, hash } = generateWebhookSecret();
    const org = await db.organization.update({
      where: { id: orgId },
      data: { paymentWebhookSecretHash: hash },
    });
    return NextResponse.json({
      organization: publicOrg(org),
      paymentWebhookSecret: raw,
      webhookUrl: "/api/webhooks/payments",
    });
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
        {
          error: `That ${key === "supportEmail" ? "support" : "e-Transfer"} email doesn't look valid`,
        },
        { status: 400 }
      );
    }
    data[key] = v || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const org = await db.organization.update({ where: { id: orgId }, data });
  return NextResponse.json({ organization: publicOrg(org) });
}
