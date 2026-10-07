import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { parseDollarsToCents } from "@/lib/money";
import {
  findOrgByWebhookSecret,
  orgHasPaymentAutoMatch,
  processPaymentIntake,
  type IntakeMethod,
} from "@/lib/paymentIntake";

/**
 * Inbound payment notification webhook (Interac email bot, future Zelle).
 *
 * Auth: Authorization: Bearer <org webhook secret>
 * Enabled for Pro orgs or orgs with paymentAutoMatchEnabled (pilot flag).
 *
 * Matching (auto-apply only):
 *   1. Unique pending order whose refCode appears in message (any case)
 *   2. Else unique pending order matching senderEmail + amount ≤ owing
 * Ambiguous / no match → NEEDS_REVIEW (200). Same externalId → ALREADY_PROCESSED.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`payment-webhook:${clientIp(req)}`, {
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!m) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rawSecret = m[1].trim();
  if (!rawSecret || rawSecret.length < 16) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await findOrgByWebhookSecret(rawSecret);
  if (!org) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgHasPaymentAutoMatch(org)) {
    return NextResponse.json(
      { error: "Payment auto-match is not enabled for this organization" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const externalId = String(body.externalId || body.interacReference || "").trim();
  if (!externalId || externalId.length < 4 || externalId.length > 128) {
    return NextResponse.json(
      { error: "externalId (or interacReference) is required" },
      { status: 400 }
    );
  }

  const methodRaw = String(body.method || "ETRANSFER").trim().toUpperCase();
  if (methodRaw !== "ETRANSFER" && methodRaw !== "ZELLE") {
    return NextResponse.json(
      { error: "method must be ETRANSFER or ZELLE" },
      { status: 400 }
    );
  }
  const method = methodRaw as IntakeMethod;

  let amountCents: number;
  if (typeof body.amountCents === "number" && Number.isInteger(body.amountCents)) {
    amountCents = body.amountCents;
  } else if (body.amount != null) {
    const parsed = parseDollarsToCents(String(body.amount));
    if (parsed == null) {
      return NextResponse.json(
        { error: "Enter a valid amount, like 25 or 25.00" },
        { status: 400 }
      );
    }
    amountCents = parsed;
  } else {
    return NextResponse.json(
      { error: "amountCents or amount is required" },
      { status: 400 }
    );
  }
  if (amountCents <= 0 || amountCents > 2_000_000) {
    return NextResponse.json({ error: "Amount is out of range" }, { status: 400 });
  }

  try {
    const result = await processPaymentIntake({
      orgId: org.id,
      payload: body,
      input: {
        externalId,
        method,
        amountCents,
        currency: body.currency == null ? "CAD" : String(body.currency),
        message: body.message == null ? null : String(body.message),
        senderName: body.senderName == null ? null : String(body.senderName),
        senderEmail: body.senderEmail == null ? null : String(body.senderEmail),
        receivedAt:
          body.receivedAt == null ? null : (body.receivedAt as string),
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not process payment";
    console.error("[webhooks/payments]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
