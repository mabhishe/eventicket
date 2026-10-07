import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "./db";
import { recordPayment } from "./payments";
import { summarizePayments } from "./money";
import { confirmPendingOrder } from "./confirmOrder";
import { planOf } from "./plans";

/** Same alphabet as ticket/ref codes — no ambiguous 0/1/I/L/O. */
export const REF_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const REF_CODE_LEN = 6;

export type IntakeMethod = "ETRANSFER" | "ZELLE";
export type IntakeStatus =
  | "APPLIED"
  | "NEEDS_REVIEW"
  | "IGNORED"
  | "ALREADY_PROCESSED";
export type MatchTier = "CODE" | "EMAIL_AMOUNT";

export type PaymentIntakeInput = {
  externalId: string;
  method: IntakeMethod;
  amountCents: number;
  currency?: string;
  message?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  receivedAt?: string | Date | null;
};

export type IntakeCandidate = {
  orderId: string;
  refCode: string | null;
  buyerName: string;
  buyerEmail: string | null;
  owingCents: number;
  totalCents: number;
};

export type ProcessIntakeResult = {
  status: IntakeStatus;
  match: {
    tier: MatchTier | null;
    orderId: string | null;
    refCode: string | null;
  };
  paymentId: string | null;
  confirmed: boolean;
  intakeId: string;
  candidates: IntakeCandidate[];
};

export function hashWebhookSecret(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateWebhookSecret(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashWebhookSecret(raw) };
}

export function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Pro plan or explicit pilot flag (Canosa). */
export function orgHasPaymentAutoMatch(org: {
  plan?: string | null;
  paymentAutoMatchEnabled?: boolean | null;
}): boolean {
  return !!org.paymentAutoMatchEnabled || planOf(org) === "PRO";
}

function isRefCodeShape(token: string): boolean {
  if (token.length !== REF_CODE_LEN) return false;
  if (!new RegExp(`^[${REF_CODE_ALPHABET}]+$`).test(token)) return false;
  // Require a digit so English words (THANKS, etc.) are not treated as codes.
  // Matching still intersects with pending refCodes, so rare all-letter codes
  // are only missed when buried in prose — bare all-letter messages still work
  // via the exact-token path below when the whole message is the code.
  return /\d/.test(token);
}

/**
 * Pull 6-char ref-code shaped tokens from an Interac/Zelle message.
 * Splits on punctuation/whitespace so neighboring words are not glued together.
 */
export function extractRefCodes(message: string | null | undefined): string[] {
  if (!message) return [];
  const found = new Set<string>();
  const upper = message.toUpperCase();
  const tokens = upper.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    if (isRefCodeShape(token)) {
      found.add(token);
      continue;
    }
    // "CODE3UMS7U" / "3UMS7UPLEASE" — scan inside longer alphanumeric runs
    if (token.length > REF_CODE_LEN) {
      const re = new RegExp(`[${REF_CODE_ALPHABET}]{${REF_CODE_LEN}}`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(token)) !== null) {
        if (isRefCodeShape(m[0])) found.add(m[0]);
      }
    }
  }
  // Entire message is exactly the code (including rare all-letter codes).
  const bare = upper.replace(/[^A-Z0-9]/g, "");
  if (
    bare.length === REF_CODE_LEN &&
    new RegExp(`^[${REF_CODE_ALPHABET}]+$`).test(bare)
  ) {
    found.add(bare);
  }
  return [...found];
}

function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email || "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}

type PendingOrder = {
  id: string;
  refCode: string | null;
  buyerName: string;
  buyerEmail: string | null;
  totalCents: number;
  payments: { kind: string; amountCents: number }[];
};

function owingCents(order: PendingOrder): number {
  return summarizePayments(order.payments, order.totalCents).balance;
}

function toCandidate(order: PendingOrder): IntakeCandidate {
  return {
    orderId: order.id,
    refCode: order.refCode,
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    owingCents: owingCents(order),
    totalCents: order.totalCents,
  };
}

async function loadPendingOrders(orgId: string): Promise<PendingOrder[]> {
  return db.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      event: { organizationId: orgId },
    },
    select: {
      id: true,
      refCode: true,
      buyerName: true,
      buyerEmail: true,
      totalCents: true,
      payments: { select: { kind: true, amountCents: true } },
    },
  });
}

type MatchResult =
  | { tier: MatchTier; order: PendingOrder; candidates: IntakeCandidate[] }
  | { tier: null; order: null; candidates: IntakeCandidate[] };

function matchOrder(
  pending: PendingOrder[],
  input: PaymentIntakeInput
): MatchResult {
  const codes = extractRefCodes(input.message);
  const allCandidates = pending.map(toCandidate);

  if (codes.length > 0) {
    const byCode = pending.filter(
      (o) => o.refCode && codes.includes(o.refCode.toUpperCase())
    );
    if (byCode.length === 1) {
      return {
        tier: "CODE",
        order: byCode[0],
        candidates: byCode.map(toCandidate),
      };
    }
    if (byCode.length > 1) {
      return {
        tier: null,
        order: null,
        candidates: byCode.map(toCandidate),
      };
    }
  }

  const email = normalizeEmail(input.senderEmail);
  if (email) {
    const byEmail = pending.filter((o) => {
      const be = normalizeEmail(o.buyerEmail);
      if (!be || be !== email) return false;
      return owingCents(o) > 0 && input.amountCents <= owingCents(o);
    });
    const exact = byEmail.filter((o) => owingCents(o) === input.amountCents);
    const pool = exact.length > 0 ? exact : byEmail;
    if (pool.length === 1) {
      return {
        tier: "EMAIL_AMOUNT",
        order: pool[0],
        candidates: pool.map(toCandidate),
      };
    }
    if (pool.length > 1) {
      return { tier: null, order: null, candidates: pool.map(toCandidate) };
    }
  }

  const byAmount = pending.filter((o) => owingCents(o) === input.amountCents);
  return {
    tier: null,
    order: null,
    candidates:
      byAmount.length > 0
        ? byAmount.map(toCandidate)
        : allCandidates.slice(0, 10),
  };
}

function parseReceivedAt(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function alreadyResult(existing: {
  id: string;
  matchTier: string | null;
  orderId: string | null;
  paymentId: string | null;
  confirmed: boolean;
}): ProcessIntakeResult {
  return {
    status: "ALREADY_PROCESSED",
    match: {
      tier: (existing.matchTier as MatchTier | null) || null,
      orderId: existing.orderId,
      refCode: null,
    },
    paymentId: existing.paymentId,
    confirmed: existing.confirmed,
    intakeId: existing.id,
    candidates: [],
  };
}

/**
 * Idempotent intake: claim (org, externalId) first so retries never
 * double-record. Unique CODE or EMAIL_AMOUNT match → RECEIVED (+ confirm
 * when paid in full). Otherwise NEEDS_REVIEW.
 */
export async function processPaymentIntake(opts: {
  orgId: string;
  input: PaymentIntakeInput;
  payload: unknown;
}): Promise<ProcessIntakeResult> {
  const { orgId, input } = opts;
  const externalId = input.externalId.trim();
  const currency = (input.currency || "CAD").trim().toUpperCase() || "CAD";
  const method = input.method;
  const amountCents = input.amountCents;

  const existing = await db.paymentIntake.findUnique({
    where: {
      organizationId_externalId: { organizationId: orgId, externalId },
    },
  });
  if (existing) return alreadyResult(existing);

  // Claim the external id before touching money (idempotency under concurrency).
  let intake;
  try {
    intake = await db.paymentIntake.create({
      data: {
        organizationId: orgId,
        externalId,
        method,
        amountCents,
        currency,
        message: input.message?.trim() || null,
        senderName: input.senderName?.trim() || null,
        senderEmail: normalizeEmail(input.senderEmail),
        receivedAt: parseReceivedAt(input.receivedAt),
        status: "NEEDS_REVIEW",
        matchTier: null,
        orderId: null,
        paymentId: null,
        confirmed: false,
        payloadJson: JSON.stringify(opts.payload),
      },
    });
  } catch {
    const raced = await db.paymentIntake.findUnique({
      where: {
        organizationId_externalId: { organizationId: orgId, externalId },
      },
    });
    if (raced) return alreadyResult(raced);
    throw new Error("Could not record payment intake");
  }

  const pending = await loadPendingOrders(orgId);
  const matched = matchOrder(pending, input);

  if (!matched.order || !matched.tier) {
    return {
      status: "NEEDS_REVIEW",
      match: { tier: null, orderId: null, refCode: null },
      paymentId: null,
      confirmed: false,
      intakeId: intake.id,
      candidates: matched.candidates,
    };
  }

  const order = matched.order;
  const methodLabel = method === "ZELLE" ? "Zelle" : "Interac";
  const payment = await recordPayment({
    orderId: order.id,
    orgId,
    userId: null,
    kind: "RECEIVED",
    amountCents,
    reason: `Payment bot · ${methodLabel} ${externalId}`.slice(0, 200),
    method,
  });

  let confirmed = false;
  const refreshed = await db.order.findFirst({
    where: { id: order.id },
    include: { payments: true },
  });
  if (
    refreshed &&
    refreshed.status === "PENDING_PAYMENT" &&
    summarizePayments(refreshed.payments, refreshed.totalCents).canConfirm
  ) {
    const result = await confirmPendingOrder({
      orderId: order.id,
      orgId,
      confirmedById: null,
    });
    confirmed = result.ok;
  }

  const updated = await db.paymentIntake.update({
    where: { id: intake.id },
    data: {
      status: "APPLIED",
      matchTier: matched.tier,
      orderId: order.id,
      paymentId: payment.id,
      confirmed,
      resolvedAt: new Date(),
    },
  });

  return {
    status: "APPLIED",
    match: {
      tier: matched.tier,
      orderId: order.id,
      refCode: order.refCode,
    },
    paymentId: payment.id,
    confirmed,
    intakeId: updated.id,
    candidates: matched.candidates,
  };
}

/** Resolve org from a raw bearer webhook secret. */
export async function findOrgByWebhookSecret(rawSecret: string): Promise<{
  id: string;
  plan: string;
  paymentAutoMatchEnabled: boolean;
  paymentWebhookSecretHash: string | null;
} | null> {
  const hash = hashWebhookSecret(rawSecret);
  const orgs = await db.organization.findMany({
    where: { paymentWebhookSecretHash: { not: null } },
    select: {
      id: true,
      plan: true,
      paymentAutoMatchEnabled: true,
      paymentWebhookSecretHash: true,
    },
  });
  for (const org of orgs) {
    if (
      org.paymentWebhookSecretHash &&
      secretsEqual(org.paymentWebhookSecretHash, hash)
    ) {
      return org;
    }
  }
  return null;
}
