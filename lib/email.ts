import QRCode from "qrcode";
import { formatCents } from "./money";
import { formatEventWhen } from "./datetime";
import { eventPreviewVersion, withPreviewVersion } from "./eventPreview";
import { eventShareImagePath } from "./eventSharePath";

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function accentOf(color: string | null | undefined): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#16a34a";
}

/**
 * Transactional email via Resend (https://resend.com).
 *
 * Env:
 *   RESEND_API_KEY — required to send; when unset, all sends are skipped
 *     (logged) so the app works fine without email configured.
 *   EMAIL_FROM     — e.g. "EventPass <tickets@events.aicloudconsult.com>".
 *     Must be a sender verified in Resend. When unset, sends are skipped.
 *   APP_URL        — public base URL, used for order/ticket links.
 */

type EmailAttachment = { filename: string; content: string }; // base64

function emailConfig(): { apiKey: string; from: string } | null {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.EMAIL_FROM || "").trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/** Send one email. Never throws — returns false when skipped or failed. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  const cfg = emailConfig();
  if (!cfg) {
    console.warn("[email] skipped (RESEND_API_KEY or EMAIL_FROM not set)");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        attachments: (opts.attachments || []).map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend error", res.status, body.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send failed", e instanceof Error ? e.message : e);
    return false;
  }
}

/** PNG buffer of an order's group-pass QR (encodes the raw refCode). */
export async function orderQrPngBuffer(refCode: string): Promise<Buffer> {
  return QRCode.toBuffer(refCode.trim().toUpperCase(), {
    margin: 1,
    width: 480,
  });
}

type EventMailInfo = {
  title: string;
  date: Date;
  venue: string | null;
  timezone?: string | null;
  brandColor: string | null;
  etransferEmail: string | null;
  zelleHandle: string | null;
  cashNote: string | null;
};

type OrderMailInfo = {
  id: string;
  buyerName: string;
  buyerEmail: string | null;
  payMethod: string;
  refCode: string | null;
  totalCents: number;
  currency: string;
  items: { qty: number; name: string; holderName: string | null }[];
};

function fmtDate(d: Date, timeZone?: string | null): string {
  return formatEventWhen(d, timeZone);
}

export function shell(opts: {
  accent: string;
  preheader: string;
  body: string;
  footer?: string;
}): string {
  const footer =
    opts.footer ??
    "Sent by EventPass for the event organizer. If you didn't place this order, you can ignore this email.";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
<div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
<div style="background:${opts.accent};padding:24px;color:#ffffff;">
<p style="margin:0;font-size:13px;opacity:.85;">EventPass</p>
</div>
<div style="padding:24px;">${opts.body}</div>
<div style="padding:16px 24px;border-top:1px solid #f4f4f5;">
<p style="margin:0;font-size:12px;color:#a1a1aa;">${esc(footer)}</p>
</div>
</div>
</div>
</body></html>`;
}

function paymentInstructions(order: OrderMailInfo, event: EventMailInfo): string {
  const memo = order.refCode
    ? `<p style="margin:8px 0 0;font-size:14px;">Include this code in your transfer message: <strong style="font-family:monospace;letter-spacing:2px;">${esc(order.refCode)}</strong></p>`
    : "";
  if (order.payMethod === "ETRANSFER" && event.etransferEmail) {
    return `<p style="margin:0 0 8px;font-size:14px;"><strong>How to pay:</strong> send ${formatCents(order.totalCents, order.currency)} by Interac e-Transfer to <strong>${esc(event.etransferEmail)}</strong>.</p>${memo}`;
  }
  if (order.payMethod === "ZELLE" && event.zelleHandle) {
    return `<p style="margin:0 0 8px;font-size:14px;"><strong>How to pay:</strong> send ${formatCents(order.totalCents, order.currency)} by Zelle to <strong>${esc(event.zelleHandle)}</strong>.</p>${memo}`;
  }
  if (order.payMethod === "CASH" && event.cashNote) {
    return `<p style="margin:0 0 8px;font-size:14px;"><strong>How to pay:</strong> ${esc(event.cashNote)}</p>${memo}`;
  }
  return `<p style="margin:0 0 8px;font-size:14px;"><strong>Amount due:</strong> ${formatCents(order.totalCents, order.currency)}.${memo}</p>`;
}

function orderLines(order: OrderMailInfo): string {
  return order.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;font-size:14px;">${it.qty} × ${esc(it.name)}${it.holderName ? ` <span style="color:#71717a;">(${esc(it.holderName)})</span>` : ""}</td></tr>`
    )
    .join("");
}

/** "We received your order" — sent right after registration. */
export function orderConfirmationHtml(
  order: OrderMailInfo,
  event: EventMailInfo,
  orderUrl: string
): string {
  const accent = accentOf(event.brandColor);
  const body = `
<p style="margin:0 0 8px;font-size:20px;font-weight:700;">We've got your order, ${esc(order.buyerName.split(" ")[0])}! 🎉</p>
<p style="margin:0 0 16px;font-size:14px;color:#52525b;">You're registered for <strong>${esc(event.title)}</strong><br>${fmtDate(event.date, event.timezone)}${event.venue ? ` · ${esc(event.venue)}` : ""}</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${orderLines(order)}
<tr><td style="padding:8px 0 0;border-top:1px solid #e4e4e7;font-size:15px;font-weight:700;">Total due: ${formatCents(order.totalCents, order.currency)}</td></tr></table>
${paymentInstructions(order, event)}
<p style="margin:16px 0 0;font-size:14px;color:#52525b;">Once the organizer confirms your full payment, each person gets their own QR code. A short payment stays pending until the rest arrives.</p>
<p style="margin:16px 0 0;"><a href="${esc(orderUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">View your order</a></p>`;
  return shell({
    accent,
    preheader: `Your order for ${event.title} is in — payment instructions inside.`,
    body,
  });
}

/** "Payment confirmed — here's your QR" — sent when the admin confirms. */
export function ticketsIssuedHtml(
  order: OrderMailInfo,
  event: EventMailInfo,
  groupCode: string,
  orderUrl: string,
  people: { code: string; holderName: string | null }[] = []
): string {
  const accent = accentOf(event.brandColor);
  const base = appUrl();
  const list =
    people.length > 0
      ? `<ul style="margin:0 0 16px;padding-left:18px;">${people
          .map((p) => {
            const href = esc(base ? `${base}/t/${p.code}` : `${orderUrl}`);
            const name = esc(p.holderName || order.buyerName);
            return `<li style="margin:0 0 6px;font-size:14px;"><strong>${name}</strong> — <a href="${href}">${href}</a></li>`;
          })
          .join("")}</ul>`
      : "";
  const body = `
<p style="margin:0 0 8px;font-size:20px;font-weight:700;">You're in! 🎟️</p>
<p style="margin:0 0 16px;font-size:14px;color:#52525b;">Your payment for <strong>${esc(event.title)}</strong> is confirmed.<br>${fmtDate(event.date, event.timezone)}${event.venue ? ` · ${esc(event.venue)}` : ""}</p>
<p style="margin:0 0 12px;font-size:14px;color:#52525b;">Each person shows their own QR at the door and at the food line. Open that person's link and save the QR.</p>
${list}
<p style="margin:0 0 16px;font-size:14px;color:#52525b;">Family lookup code <strong style="font-family:monospace;letter-spacing:2px;">${esc(groupCode)}</strong> is for staff if someone arrives without their own QR. It does not check a person in by itself.</p>
<p style="margin:0;"><a href="${esc(orderUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">Open your tickets</a></p>`;
  return shell({
    accent,
    preheader: `Payment confirmed — your QR code for ${event.title} is inside.`,
    body,
  });
}

export function appUrl(): string {
  return (process.env.APP_URL || "").replace(/\/$/, "");
}

/** Personal "I'm going" link. The ?v= value matches the order page share. */
export function buyerInviteUrl(input: {
  slug: string;
  inviteCode: string | null | undefined;
  title: string;
  date: Date | string;
  venue?: string | null;
  description?: string | null;
}): string {
  const base = appUrl();
  const code = input.inviteCode?.trim();
  if (!base || !code) return "";
  return withPreviewVersion(
    `${base}/e/${input.slug}?invite=${encodeURIComponent(code)}`,
    eventPreviewVersion({
      title: input.title,
      date: input.date,
      venue: input.venue,
      description: input.description,
    })
  );
}

/** Banner plus invite link, placed above the email footer. */
export function inviteShareEmailHtml(input: {
  title: string;
  when: string;
  venue?: string | null;
  inviteUrl: string;
  imageUrl: string;
}): string {
  if (!input.inviteUrl) return "";
  const venue = input.venue?.trim() ? `<br>${esc(input.venue.trim())}` : "";
  const image = input.imageUrl
    ? `<a href="${esc(input.inviteUrl)}" style="text-decoration:none;"><img src="${esc(input.imageUrl)}" alt="${esc(`I'm going to ${input.title}`)}" width="512" style="display:block;width:100%;max-width:512px;height:auto;border:0;border-radius:12px;" /></a>`
    : "";
  return `<div style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e4e4e7;">
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1c1917;">I'm going to ${esc(input.title)}!</p>
${image}
<p style="margin:12px 0 0;font-size:14px;color:#52525b;">${esc(input.when)}${venue}</p>
<p style="margin:12px 0 0;font-size:14px;color:#1c1917;">Are you joining?</p>
<p style="margin:12px 0 0;"><a href="${esc(input.inviteUrl)}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px;">Send this to a friend</a></p>
<p style="margin:10px 0 0;font-size:12px;color:#71717a;word-break:break-all;">${esc(input.inviteUrl)}</p>
</div>`;
}

export function eventShareImageUrl(slug: string): string {
  const base = appUrl();
  if (!base) return "";
  return `${base}${eventShareImagePath(slug)}`;
}

/** Invite block for the order-received and payment-confirmed emails. */
export function buyerInviteEmailBlock(input: {
  slug: string;
  inviteCode: string | null | undefined;
  title: string;
  date: Date | string;
  venue?: string | null;
  description?: string | null;
  timezone?: string | null;
}): string {
  return inviteShareEmailHtml({
    title: input.title,
    when: formatEventWhen(input.date, input.timezone),
    venue: input.venue,
    inviteUrl: buyerInviteUrl(input),
    imageUrl: eventShareImageUrl(input.slug),
  });
}

/** "Verify your email" — sent after signup / team invite. */
export function verifyEmailHtml(name: string, verifyUrl: string): string {
  const body = `
<p style="margin:0 0 8px;font-size:20px;font-weight:700;">Confirm your email, ${esc(name.split(" ")[0])} ✉️</p>
<p style="margin:0 0 16px;font-size:14px;color:#52525b;">One quick step before you can publish events: confirm this email address belongs to you.</p>
<p style="margin:0 0 16px;"><a href="${esc(verifyUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">Verify my email</a></p>
<p style="margin:0;font-size:12px;color:#71717a;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`;
  return shell({
    accent: "#16a34a",
    preheader: "Confirm your email to start publishing events.",
    body,
  });
}

/** "Reset your password" — single-use, expires in 1 hour. */
export function resetPasswordHtml(name: string, resetUrl: string): string {
  const body = `
<p style="margin:0 0 8px;font-size:20px;font-weight:700;">Reset your password</p>
<p style="margin:0 0 16px;font-size:14px;color:#52525b;">Hi ${esc(name.split(" ")[0])}, someone requested a password reset for your account. Click below to choose a new one.</p>
<p style="margin:0 0 16px;"><a href="${esc(resetUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">Choose a new password</a></p>
<p style="margin:0;font-size:12px;color:#71717a;">This link expires in 1 hour and can only be used once. If you didn't ask for this, you can ignore this email — your password stays the same.</p>`;
  return shell({
    accent: "#16a34a",
    preheader: "Choose a new password for your account.",
    body,
  });
}
