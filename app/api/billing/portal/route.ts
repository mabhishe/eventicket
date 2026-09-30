import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { stripe, appUrl } from "@/lib/stripe";

/** Open the Stripe customer portal (change card, cancel). Owner/admin only. */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`billing:${clientIp(req)}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many billing attempts, try again later" },
      { status: 429 }
    );
  }
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;

  const org = await db.organization.findUnique({
    where: { id: auth.user.orgId },
    select: { stripeCustomerId: true },
  });
  if (!org?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet" },
      { status: 404 }
    );
  }
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appUrl()}/admin/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Billing not configured" },
      { status: 503 }
    );
  }
}
