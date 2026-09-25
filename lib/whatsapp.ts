/**
 * WhatsApp notifications via Meta's WhatsApp Business Cloud API.
 *
 * Env:
 *   WHATSAPP_TOKEN            — system-user access token with whatsapp_business_messaging
 *   WHATSAPP_PHONE_NUMBER_ID  — the sender's Phone Number ID from WhatsApp Manager
 *   WHATSAPP_API_VERSION      — Graph API version (default "v26.0")
 *   WHATSAPP_TEMPLATE_ORDER   — template name for order confirmations
 *   WHATSAPP_TEMPLATE_TICKETS — template name for tickets (uses an image header)
 *
 * When WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is unset, all sends are
 * skipped (logged) so the app works fine without WhatsApp configured.
 *
 * Both templates must be created and APPROVED in WhatsApp Manager before
 * sending. See README "WhatsApp setup" for the exact template text.
 */

type TemplateParam = { type: "text"; text: string };

function waConfig(): {
  token: string;
  phoneNumberId: string;
  version: string;
} | null {
  const token = (process.env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    version: (process.env.WHATSAPP_API_VERSION || "v26.0").trim() || "v26.0",
  };
}

/**
 * Normalize a free-text phone number to E.164.
 * Assumes North America (+1) for 10-digit numbers.
 * Returns null when it can't be normalized.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15)
    return `+${digits}`;
  return null;
}

function templatePayload(opts: {
  to: string;
  template: string;
  language?: string;
  headerImageUrl?: string;
  bodyParams: string[];
}): Record<string, unknown> {
  const components: Record<string, unknown>[] = [];
  if (opts.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        { type: "image", image: { link: opts.headerImageUrl } },
      ],
    });
  }
  if (opts.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: opts.bodyParams.map(
        (t): TemplateParam => ({ type: "text", text: t })
      ),
    });
  }
  return {
    messaging_product: "whatsapp",
    to: opts.to,
    type: "template",
    template: {
      name: opts.template,
      language: { code: opts.language || "en_US" },
      components,
    },
  };
}

/** Send one template message. Never throws — returns false when skipped/failed. */
export async function sendWhatsAppTemplate(opts: {
  to: string;
  template: string;
  headerImageUrl?: string;
  bodyParams: string[];
}): Promise<boolean> {
  const cfg = waConfig();
  if (!cfg) {
    console.warn(
      "[whatsapp] skipped (WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set)"
    );
    return false;
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templatePayload(opts)),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[whatsapp] API error", res.status, body.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error(
      "[whatsapp] send failed",
      e instanceof Error ? e.message : e
    );
    return false;
  }
}

export function orderTemplateName(): string {
  return (
    process.env.WHATSAPP_TEMPLATE_ORDER || "eventpass_order_confirmation"
  ).trim();
}

export function ticketsTemplateName(): string {
  return (
    process.env.WHATSAPP_TEMPLATE_TICKETS || "eventpass_tickets_issued"
  ).trim();
}
