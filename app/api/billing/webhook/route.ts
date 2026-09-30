import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/**
 * Stripe webhook. Verifies the signature, then flips the org plan:
 *  - checkout.session.completed / subscription active/trialing -> PRO
 *  - subscription deleted -> FREE
 *  - subscription past_due/unpaid -> status recorded, plan stays PRO until deleted
 *
 * The org is resolved from the Stripe customer id (never from client input).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  async function orgIdForCustomer(customerId: string): Promise<string | null> {
    const org = await db.organization.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    return org?.id ?? null;
  }

  async function setPlan(
    customerId: string,
    plan: "FREE" | "PRO",
    subscriptionId: string | null,
    status: string
  ) {
    const orgId = await orgIdForCustomer(customerId);
    if (!orgId) return;
    await db.organization.update({
      where: { id: orgId },
      data: {
        plan,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: status,
      },
    });
  }

  const customerIdOf = (obj: {
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  }) => (typeof obj.customer === "string" ? obj.customer : null);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = customerIdOf(session);
      const subId =
        typeof session.subscription === "string" ? session.subscription : null;
      if (customerId) {
        await setPlan(customerId, "PRO", subId, "ACTIVE");
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = customerIdOf(sub);
      if (customerId) {
        const status = sub.status.toUpperCase();
        if (status === "ACTIVE" || status === "TRIALING") {
          await setPlan(customerId, "PRO", sub.id, status);
        } else {
          // past_due / unpaid / incomplete: keep Pro until Stripe deletes it,
          // but record the status so the Plan page can warn.
          const orgId = await orgIdForCustomer(customerId);
          if (orgId) {
            await db.organization.update({
              where: { id: orgId },
              data: { subscriptionStatus: status },
            });
          }
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = customerIdOf(sub);
      if (customerId) {
        await setPlan(customerId, "FREE", null, "CANCELED");
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
