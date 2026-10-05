import { formatCents, summarizePayments } from "./money";
import { appUrl, shell } from "./email";

/** Local hour when the organizer summary goes out. Later hours the same night still send it once. */
export const DIGEST_HOUR = 22;

const PAY_LABEL: Record<string, string> = {
  ETRANSFER: "e-Transfer",
  ZELLE: "Zelle",
  CASH: "Cash",
};

export type DigestOrder = {
  buyerName: string;
  buyerEmail?: string | null;
  refCode: string | null;
  totalCents: number;
  currency: string;
  payMethod: string;
  status: string;
  eventTitle: string;
  ticketCount: number;
  receivedCents: number;
  owingCents: number;
};

export function localClock(
  now: Date,
  timeZone: string
): { hour: number; dateKey: string } | null {
  let parts: Record<string, string>;
  try {
    parts = zonedParts(now, timeZone);
  } catch {
    return null;
  }
  const hour = Number(parts.hour);
  if (!Number.isFinite(hour)) return null;
  return {
    hour: hour === 24 ? 0 : hour,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Midnight at the start of `now`'s calendar day in `timeZone`. */
export function localDayStart(now: Date, timeZone: string): Date | null {
  let parts: Record<string, string>;
  try {
    parts = zonedParts(now, timeZone);
  } catch {
    return null;
  }
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  const offsetMs = asUtc - now.getTime();
  const midnightUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    0,
    0,
    0
  );
  return new Date(midnightUtc - offsetMs);
}

function zonedParts(now: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(
    fmt
      .formatToParts(now)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
}

/** Owners, admins, and the org support inbox. Door staff are left out. */
export function digestRecipients(
  emails: (string | null | undefined)[],
  supportEmail?: string | null
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...emails, supportEmail]) {
    const email = (raw || "").trim();
    if (!email || !email.includes("@")) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function digestHasNews(input: {
  registered: DigestOrder[];
  paid: DigestOrder[];
  waiting: DigestOrder[];
}): boolean {
  return (
    input.registered.length > 0 ||
    input.paid.length > 0 ||
    input.waiting.length > 0
  );
}

export function digestSubject(input: {
  registered: number;
  paid: number;
  waiting: number;
}): string {
  if (input.waiting > 0) {
    return `Tonight — ${input.waiting} still unpaid`;
  }
  if (input.paid > 0) {
    return `Tonight — ${input.paid} paid today`;
  }
  return `Tonight — ${input.registered} registered`;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function payLabel(method: string): string {
  return PAY_LABEL[method] || method;
}

function statusLabel(order: DigestOrder): string {
  if (order.status === "CONFIRMED") return "paid";
  if (order.status === "CANCELLED") return "cancelled";
  if (order.receivedCents > 0 && order.owingCents > 0) {
    return `received ${formatCents(order.receivedCents, order.currency)} of ${formatCents(order.totalCents, order.currency)}`;
  }
  return "still unpaid";
}

function orderBlock(order: DigestOrder, detail: string): string {
  const code = order.refCode
    ? ` · code <strong style="font-family:monospace;letter-spacing:1px;">${esc(order.refCode)}</strong>`
    : "";
  const email = order.buyerEmail
    ? `<br><span style="color:#71717a;">${esc(order.buyerEmail)}</span>`
    : "";
  return `<p style="margin:0 0 12px;font-size:14px;"><strong>${esc(order.buyerName)}</strong>${code}${email}<br><span style="color:#52525b;">${esc(order.eventTitle)} · ${order.ticketCount} ticket${order.ticketCount === 1 ? "" : "s"} · ${esc(detail)}</span></p>`;
}

function section(title: string, empty: string, orders: DigestOrder[], line: (o: DigestOrder) => string): string {
  const body =
    orders.length === 0
      ? `<p style="margin:0 0 16px;font-size:14px;color:#71717a;">${esc(empty)}</p>`
      : orders.map((o) => orderBlock(o, line(o))).join("");
  return `<p style="margin:16px 0 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#a1a1aa;">${esc(title)} (${orders.length})</p>${body}`;
}

export function digestHtml(input: {
  orgName: string;
  registered: DigestOrder[];
  paid: DigestOrder[];
  waiting: DigestOrder[];
}): { subject: string; html: string } {
  const subject = digestSubject({
    registered: input.registered.length,
    paid: input.paid.length,
    waiting: input.waiting.length,
  });
  const ordersUrl = appUrl() ? `${appUrl()}/admin/orders` : "";
  const button = ordersUrl
    ? `<p style="margin:16px 0 0;"><a href="${esc(ordersUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">Open orders</a></p>`
    : "";
  const body = `
<p style="margin:0 0 8px;font-size:20px;font-weight:700;">Tonight’s orders</p>
<p style="margin:0 0 4px;font-size:14px;color:#52525b;">10:00 p.m. summary for <strong>${esc(input.orgName)}</strong>.</p>
<p style="margin:0;font-size:14px;color:#52525b;">Match each code to the e-Transfer, then confirm the order. A short payment stays pending until the rest arrives.</p>
${section("Registered today", "No new registrations today.", input.registered, (o) => `${formatCents(o.totalCents, o.currency)} · ${payLabel(o.payMethod)} · ${statusLabel(o)}`)}
${section("Paid today", "No payments confirmed today.", input.paid, (o) => `${formatCents(o.totalCents, o.currency)} · ${payLabel(o.payMethod)} · paid`)}
${section("Still waiting", "Nothing waiting.", input.waiting, (o) => {
    const owing = `${formatCents(o.owingCents, o.currency)} owing · ${payLabel(o.payMethod)}`;
    return o.receivedCents > 0
      ? `${owing} · received ${formatCents(o.receivedCents, o.currency)} of ${formatCents(o.totalCents, o.currency)}`
      : owing;
  })}
${button}`;
  return {
    subject,
    html: shell({
      accent: "#16a34a",
      preheader: subject,
      body,
      footer: `Nightly summary for organizers of ${input.orgName}. Buyers do not receive this email.`,
    }),
  };
}

export function toDigestOrder(order: {
  buyerName: string;
  buyerEmail?: string | null;
  refCode: string | null;
  totalCents: number;
  payMethod: string;
  status: string;
  event: { title: string; currency: string };
  items: { qty: number }[];
  payments: { kind: string; amountCents: number }[];
}): DigestOrder {
  const sum = summarizePayments(order.payments, order.totalCents);
  const legacyPaid = order.payments.length === 0 && order.status === "CONFIRMED";
  return {
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    refCode: order.refCode,
    totalCents: order.totalCents,
    currency: order.event.currency || "CAD",
    payMethod: order.payMethod,
    status: order.status,
    eventTitle: order.event.title,
    ticketCount: order.items.reduce((n, it) => n + it.qty, 0),
    receivedCents: legacyPaid ? order.totalCents : sum.net,
    owingCents: legacyPaid ? 0 : Math.max(0, order.totalCents - sum.net - sum.waived),
  };
}
