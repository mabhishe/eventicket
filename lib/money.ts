export function formatCents(cents: number, currency = "CAD"): string {
  const code = (currency || "CAD").toUpperCase();
  const formatted = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: code,
  }).format(cents / 100);
  // en-CA often prints "$40.00" for CAD. Keep the currency code visible.
  if (formatted.toUpperCase().includes(code)) return formatted;
  return `${formatted} ${code}`;
}

export type PaymentLike = { kind: string; amountCents: number };

/** Money recorded against an order. Confirm is allowed only when net received covers the total. Waivers do not count as payment. */
export function summarizePayments(payments: PaymentLike[], totalCents: number) {
  let received = 0;
  let refunded = 0;
  let waived = 0;
  for (const p of payments) {
    if (p.kind === "RECEIVED") received += p.amountCents;
    else if (p.kind === "REFUND") refunded += p.amountCents;
    else if (p.kind === "WAIVER") waived += p.amountCents;
  }
  const net = received - refunded;
  return {
    received,
    refunded,
    waived,
    net,
    balance: Math.max(0, totalCents - net),
    canConfirm: net >= totalCents,
  };
}

/** Parse a dollar entry such as "40" or "40.50" into integer cents. */
export function parseDollarsToCents(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [dollars, fraction = ""] = s.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isInteger(cents) || cents <= 0 || cents > 2_000_000) return null;
  return cents;
}
