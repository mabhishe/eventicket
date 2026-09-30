import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { stripe, proPriceId, appUrl } from "@/lib/stripe";

/**
 * Start a Pro subscription checkout. Owner/admin only.
 * Returns the Stripe-hosted checkout URL; the client redirects there.
 */
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
  const { orgId } = auth.user;

  let priceId: string;
  try {
    priceId = proPriceId();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Billing not configured" },
      { status: 503 }
    );
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: { memberships: { where: { userId: auth.user.id } } },
  });
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });
  if (org.plan === "PRO") {
    return NextResponse.json(
      { error: "Already on the Pro plan" },
      { status: 400 }
    );
  }

  const s = stripe();
  const userEmail = await db.user
    .findUnique({ where: { id: auth.user.id }, select: { email: true } })
    .then((u) => u?.email);

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await s.customers.create({
      email: userEmail || undefined,
      name: org.name,
      metadata: { organizationId: orgId },
    });
    customerId = customer.id;
    await db.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/admin/settings?billing=success`,
    cancel_url: `${appUrl()}/admin/settings?billing=cancelled`,
    metadata: { organizationId: orgId },
    subscription_data: { metadata: { organizationId: orgId } },
  });

  return NextResponse.json({ url: session.url });
}
