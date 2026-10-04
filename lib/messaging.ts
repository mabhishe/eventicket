/**
 * Messaging center (Phase 4a).
 *
 * Organizations can customize the emails buyers receive via MessageTemplate
 * rows (subject + body with {{variables}}). When no custom template exists,
 * the built-in rich defaults are used, so nothing regresses.
 *
 * WhatsApp uses Meta-approved templates with positional params; a custom
 * WhatsApp template stores the approved template name + ordered {{variable}}
 * expressions. Until the organizer configures one, the legacy env-based
 * templates keep working for order/ticket messages.
 *
 * Every send is recorded in MessageLog (used for dedup + audit).
 */
import { db } from "./db";
import { sendEmail, shell, appUrl } from "./email";
import { eventPreviewVersion, withPreviewVersion } from "./eventPreview";
import {
  sendWhatsAppTemplate,
  normalizePhone,
  orderTemplateName,
  ticketsTemplateName,
} from "./whatsapp";
import { formatCents } from "./money";

export const TEMPLATE_KEYS = {
  ORDER_RECEIVED: "ORDER_RECEIVED",
  TICKETS_ISSUED: "TICKETS_ISSUED",
  PAYMENT_REMINDER: "PAYMENT_REMINDER",
  EVENT_REMINDER: "EVENT_REMINDER",
  ORG_WELCOME: "ORG_WELCOME",
} as const;

export type TemplateKey = keyof typeof TEMPLATE_KEYS;
export type MsgChannel = "EMAIL" | "WHATSAPP";

export const TEMPLATE_DEFS: Record<
  TemplateKey,
  { label: string; description: string; channels: MsgChannel[] }
> = {
  ORDER_RECEIVED: {
    label: "Order received",
    description: "Sent when a buyer registers, before payment is confirmed.",
    channels: ["EMAIL", "WHATSAPP"],
  },
  TICKETS_ISSUED: {
    label: "Tickets issued",
    description: "Sent when the organizer confirms payment. Includes the QR code.",
    channels: ["EMAIL", "WHATSAPP"],
  },
  PAYMENT_REMINDER: {
    label: "Payment reminder",
    description: "Nightly nudge to buyers with unpaid orders.",
    channels: ["EMAIL", "WHATSAPP"],
  },
  EVENT_REMINDER: {
    label: "Event reminder",
    description: "Scheduled reminder before the event starts (see Reminders).",
    channels: ["EMAIL", "WHATSAPP"],
  },
  ORG_WELCOME: {
    label: "Organization welcome",
    description: "Sent when an organization is created.",
    channels: ["EMAIL"],
  },
};

/** Variables available in every template. */
export const TEMPLATE_VARS = [
  "{{buyer.name}}",
  "{{event.title}}",
  "{{event.date}}",
  "{{event.venue}}",
  "{{event.url}}",
  "{{order.refCode}}",
  "{{order.entryCode}}",
  "{{order.total}}",
  "{{order.url}}",
  "{{org.name}}",
  "{{app.url}}",
] as const;

export type VarMap = Record<string, string>;

/** Replace {{dotted.names}} with values; unknown variables become "". */
export function renderVars(text: string, vars: VarMap): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, name: string) => {
    return vars[name] ?? "";
  });
}

function fmtDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

export type OrderLike = {
  id: string;
  buyerName: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  refCode?: string | null;
  entryCode?: string | null;
  totalCents: number;
  payMethod?: string | null;
};

export type EventLike = {
  id: string;
  slug: string;
  title: string;
  date: Date | string;
  venue?: string | null;
  description?: string | null;
  currency: string;
  etransferEmail?: string | null;
  zelleHandle?: string | null;
  organizationId?: string | null;
};

/** Build the {{variable}} map for order-related messages. */
export function orderVars(
  order: OrderLike,
  event: EventLike,
  orgName: string
): VarMap {
  const base = appUrl();
  return {
    "buyer.name": order.buyerName,
    "event.title": event.title,
    "event.date": fmtDate(event.date),
    "event.venue": event.venue || "",
    "event.url": base
      ? withPreviewVersion(
          `${base}/e/${event.slug}`,
          eventPreviewVersion({
            title: event.title,
            date: event.date,
            venue: event.venue,
            description: event.description,
          })
        )
      : "",
    "order.refCode": order.refCode || "",
    "order.entryCode": order.entryCode || "",
    "order.total": formatCents(order.totalCents, event.currency),
    "order.url": base ? `${base}/order/${order.id}` : "",
    "org.name": orgName,
    "app.url": base,
  };
}

/** Built-in default email templates (used when the org has no custom row). */
const DEFAULT_EMAIL: Record<TemplateKey, { subject: string; body: string }> = {
  ORDER_RECEIVED: {
    subject: "Order received — {{event.title}}",
    body: `<p>Hi {{buyer.name}},</p>
<p>We've got your order for <strong>{{event.title}}</strong> ({{event.date}}).</p>
<p>Your reference code is <strong>{{order.refCode}}</strong> and your total due is <strong>{{order.total}}</strong>.</p>
<p>Once the organizer confirms your full payment, each person gets their own QR code.</p>
<p><a href="{{order.url}}">View your order</a></p>`,
  },
  TICKETS_ISSUED: {
    subject: "You're in! Tickets for {{event.title}} 🎟️",
    body: `<p>Hi {{buyer.name}},</p>
<p>Your payment for <strong>{{event.title}}</strong> is confirmed — you're in!</p>
<p>Each person shows their own QR from the order page at the door and the food line. Family lookup code: <strong>{{order.entryCode}}</strong>.</p>
<p><a href="{{order.url}}">Open your tickets</a></p>`,
  },
  PAYMENT_REMINDER: {
    subject: "Reminder: payment due for {{event.title}}",
    body: `<p>Hi {{buyer.name}},</p>
<p>This is a friendly reminder that your order for <strong>{{event.title}}</strong> ({{event.date}}) is still awaiting payment.</p>
<p>Total due: <strong>{{order.total}}</strong> · Reference code: <strong>{{order.refCode}}</strong></p>
<p>Please send your e-Transfer with the reference code in the message, and your tickets will follow as soon as it's confirmed.</p>
<p><a href="{{order.url}}">View your order</a></p>`,
  },
  EVENT_REMINDER: {
    subject: "Reminder: {{event.title}} is coming up!",
    body: `<p>Hi {{buyer.name}},</p>
<p><strong>{{event.title}}</strong> is coming up on {{event.date}}.</p>
<p>Each person should open their own QR from the order page before they arrive. Family lookup code: <strong>{{order.entryCode}}</strong>.</p>
<p><a href="{{order.url}}">Open your tickets</a></p>`,
  },
  ORG_WELCOME: {
    subject: "Welcome to EventPass!",
    body: `<p>Hi there,</p>
<p>Your organization <strong>{{org.name}}</strong> is ready. Create an event, collect payments, and check guests in at the door.</p>
<p><a href="{{app.url}}/admin">Open your dashboard</a></p>`,
  },
};

export type EffectiveTemplate = {
  subject: string;
  body: string;
  custom: boolean;
  templateName?: string | null;
  bodyParams?: string[] | null;
};

/** Custom row if the org saved one, otherwise the built-in default. */
export async function getEffectiveTemplate(
  organizationId: string,
  key: TemplateKey,
  channel: MsgChannel
): Promise<EffectiveTemplate> {
  const row = await db.messageTemplate.findUnique({
    where: { organizationId_key_channel: { organizationId, key, channel } },
  });
  if (row) {
    let bodyParams: string[] | null = null;
    if (row.bodyParams) {
      try {
        const p = JSON.parse(row.bodyParams);
        if (Array.isArray(p)) bodyParams = p.map(String);
      } catch {
        bodyParams = null;
      }
    }
    return {
      subject: row.subject || DEFAULT_EMAIL[key].subject,
      body: row.body,
      custom: true,
      templateName: row.templateName,
      bodyParams,
    };
  }
  return {
    subject: DEFAULT_EMAIL[key].subject,
    body: DEFAULT_EMAIL[key].body,
    custom: false,
  };
}

async function logMessage(opts: {
  organizationId: string;
  eventId?: string | null;
  orderId?: string | null;
  kind: string;
  channel: MsgChannel;
  recipient: string;
  templateKey?: string | null;
  status: "SENT" | "SKIPPED" | "FAILED";
}) {
  try {
    await db.messageLog.create({ data: opts });
  } catch (e) {
    console.error("[messaging] log failed", e instanceof Error ? e.message : e);
  }
}

/**
 * Send a templated email. Returns true when actually sent.
 * `richHtml` bypasses the template body (used to keep the existing rich
 * order/ticket emails as the default until the org customizes).
 */
export async function sendTemplatedEmail(opts: {
  organizationId: string;
  templateKey: TemplateKey;
  to: string;
  vars: VarMap;
  eventId?: string | null;
  orderId?: string | null;
  kind?: string;
  richHtml?: string | null;
  attachments?: { filename: string; content: string }[];
}): Promise<boolean> {
  const tpl = await getEffectiveTemplate(
    opts.organizationId,
    opts.templateKey,
    "EMAIL"
  );
  const subject = renderVars(tpl.subject, opts.vars);
  const bodyHtml = opts.richHtml && !tpl.custom ? opts.richHtml : tpl.body;
  const rendered = renderVars(bodyHtml, opts.vars);
  // Custom bodies are wrapped in the branded shell; rich defaults already include it.
  const html =
    opts.richHtml && !tpl.custom
      ? rendered
      : shell({
          accent: "#c2410c",
          preheader: subject,
          body: rendered,
        });
  const sent = await sendEmail({
    to: opts.to,
    subject,
    html,
    attachments: opts.attachments,
  });
  await logMessage({
    organizationId: opts.organizationId,
    eventId: opts.eventId,
    orderId: opts.orderId,
    kind: opts.kind || "TEMPLATE",
    channel: "EMAIL",
    recipient: opts.to,
    templateKey: opts.templateKey,
    status: sent ? "SENT" : "SKIPPED",
  });
  return sent;
}

/**
 * Send a WhatsApp message for a template key.
 * Custom rows use their Meta template name + ordered {{variable}} params.
 * Without a custom row, `fallback` (the legacy positional-param send) runs.
 */
export async function sendTemplatedWhatsApp(opts: {
  organizationId: string;
  templateKey: TemplateKey;
  to: string;
  vars: VarMap;
  eventId?: string | null;
  orderId?: string | null;
  kind?: string;
  fallback?: () => Promise<boolean>;
}): Promise<boolean> {
  const tpl = await getEffectiveTemplate(
    opts.organizationId,
    opts.templateKey,
    "WHATSAPP"
  );
  let sent = false;
  if (tpl.custom && tpl.templateName) {
    const params = (tpl.bodyParams || []).map((expr) => {
      const m = expr.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/);
      return m ? opts.vars[m[1]] ?? "" : expr;
    });
    sent = await sendWhatsAppTemplate({
      to: opts.to,
      template: tpl.templateName,
      bodyParams: params,
    });
  } else if (opts.fallback) {
    sent = await opts.fallback();
  }
  await logMessage({
    organizationId: opts.organizationId,
    eventId: opts.eventId,
    orderId: opts.orderId,
    kind: opts.kind || "TEMPLATE",
    channel: "WHATSAPP",
    recipient: opts.to,
    templateKey: opts.templateKey,
    status: sent ? "SENT" : "SKIPPED",
  });
  return sent;
}

/** Legacy positional WhatsApp params for order-received (kept as fallback). */
export function orderReceivedWaFallback(
  order: OrderLike & { payMethod?: string | null },
  event: EventLike,
  to: string
): () => Promise<boolean> {
  return async () => {
    const total = formatCents(order.totalCents, event.currency);
    const payLine =
      order.payMethod === "ETRANSFER" && event.etransferEmail
        ? `send ${total} by Interac e-Transfer to ${event.etransferEmail}`
        : order.payMethod === "ZELLE" && event.zelleHandle
          ? `send ${total} by Zelle to ${event.zelleHandle}`
          : `pay ${total} as instructed by the organizer`;
    return sendWhatsAppTemplate({
      to,
      template: orderTemplateName(),
      bodyParams: [
        order.buyerName.split(" ")[0],
        event.title,
        fmtDate(event.date),
        total,
        payLine,
        order.refCode || "—",
      ],
    });
  };
}

/** Legacy positional WhatsApp params for tickets-issued (kept as fallback). */
export function ticketsIssuedWaFallback(
  order: OrderLike,
  event: EventLike,
  to: string
): () => Promise<boolean> {
  return async () =>
    sendWhatsAppTemplate({
      to,
      template: ticketsTemplateName(),
      bodyParams: [
        order.buyerName.split(" ")[0],
        event.title,
        order.entryCode || "—",
      ],
    });
}

export { normalizePhone };
