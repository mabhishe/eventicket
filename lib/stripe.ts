import Stripe from "stripe";

/** Lazily-built Stripe client. Throws a clear error when not configured. */
let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Stripe is not configured (STRIPE_SECRET_KEY missing)"
    );
  }
  client = new Stripe(key);
  return client;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** The Pro subscription price. Set in Stripe dashboard, stored in env. */
export function proPriceId(): string {
  const id = process.env.STRIPE_PRO_PRICE_ID;
  if (!id) throw new Error("Stripe Pro price is not configured");
  return id;
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
