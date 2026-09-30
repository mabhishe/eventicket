import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  TEMPLATE_DEFS,
  sendTemplatedEmail,
  sendTemplatedWhatsApp,
  orderVars,
  type TemplateKey,
} from "@/lib/messaging";

const MANAGERS = ["ORG_OWNER", "ORG_ADMIN"] as const;

/**
 * Send a test message using a template, filled with sample data.
 * Email goes to the signed-in user; WhatsApp needs an explicit phone number.
 */
export async function POST(req: NextRequest) {
  const auth = await requireOrgApiUser(req, [...MANAGERS]);
  if (!auth.ok) return auth.error;
  const { orgId, id: userId } = auth.user;

  const rl = checkRateLimit(`msgtest:${orgId}:${clientIp(req)}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many test sends. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const key = String(body?.key || "") as TemplateKey;
  const channel = String(body?.channel || "");
  if (!(key in TEMPLATE_DEFS) || !["EMAIL", "WHATSAPP"].includes(channel)) {
    return NextResponse.json({ error: "Unknown template or channel" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  const org = await db.organization.findUnique({ where: { id: orgId } });
  // Sample data so the organizer can see every variable filled in.
  const vars = orderVars(
    {
      id: "sample",
      buyerName: user?.name || "Sample Buyer",
      refCode: "9AZM6J",
      entryCode: "482913",
      totalCents: 11000,
    },
    {
      id: "sample",
      slug: "sample-event",
      title: "Sample Community Night",
      date: new Date(Date.now() + 7 * 86400000),
      venue: "Community Hall",
      currency: "CAD",
    },
    org?.name || "Your organization"
  );

  if (channel === "EMAIL") {
    const to = user?.email;
    if (!to) return NextResponse.json({ error: "No email on your account" }, { status: 400 });
    const sent = await sendTemplatedEmail({
      organizationId: orgId,
      templateKey: key,
      to,
      vars,
      kind: "TEST",
    });
    return NextResponse.json({ sent, to });
  }
  const phone = String(body?.phone || "").trim();
  if (!phone) {
    return NextResponse.json({ error: "Phone number is required for a WhatsApp test" }, { status: 400 });
  }
  const sent = await sendTemplatedWhatsApp({
    organizationId: orgId,
    templateKey: key,
    to: phone,
    vars,
    kind: "TEST",
    fallback: async () => false, // tests only run against a configured template
  });
  return NextResponse.json({ sent, to: phone });
}
