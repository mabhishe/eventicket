import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import {
  TEMPLATE_DEFS,
  TEMPLATE_VARS,
  getEffectiveTemplate,
  type TemplateKey,
  type MsgChannel,
} from "@/lib/messaging";

const MANAGERS = ["ORG_OWNER", "ORG_ADMIN"] as const;

function validKeyChannel(
  key: string,
  channel: string
): key is TemplateKey {
  return (
    key in TEMPLATE_DEFS &&
    (TEMPLATE_DEFS[key as TemplateKey].channels as string[]).includes(channel)
  );
}

/** List all template definitions with their effective (custom or default) content. */
export async function GET(req: NextRequest) {
  const auth = await requireOrgApiUser(req, [...MANAGERS]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const defs = await Promise.all(
    (Object.keys(TEMPLATE_DEFS) as TemplateKey[]).map(async (key) => {
      const channels = await Promise.all(
        TEMPLATE_DEFS[key].channels.map(async (channel) => ({
          channel,
          ...(await getEffectiveTemplate(orgId, key, channel)),
        }))
      );
      return {
        key,
        label: TEMPLATE_DEFS[key].label,
        description: TEMPLATE_DEFS[key].description,
        channels,
      };
    })
  );
  return NextResponse.json({ templates: defs, variables: TEMPLATE_VARS });
}

/** Create or update a custom template row. */
export async function PUT(req: NextRequest) {
  const auth = await requireOrgApiUser(req, [...MANAGERS]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const key = String(body?.key || "");
  const channel = String(body?.channel || "") as MsgChannel;
  if (!validKeyChannel(key, channel)) {
    return NextResponse.json({ error: "Unknown template or channel" }, { status: 400 });
  }
  const subject = body?.subject != null ? String(body.subject).slice(0, 200) : null;
  const text = String(body?.body || "");
  if (text.length > 20000) {
    return NextResponse.json({ error: "Body is too long (max 20,000 chars)" }, { status: 400 });
  }
  if (text.trim().length === 0) {
    return NextResponse.json({ error: "Body cannot be empty" }, { status: 400 });
  }
  const templateName =
    body?.templateName != null ? String(body.templateName).slice(0, 100).trim() || null : null;
  let bodyParams: string | null = null;
  if (body?.bodyParams != null) {
    if (!Array.isArray(body.bodyParams) || body.bodyParams.length > 20) {
      return NextResponse.json({ error: "bodyParams must be an array of up to 20 items" }, { status: 400 });
    }
    bodyParams = JSON.stringify(body.bodyParams.map((p) => String(p).slice(0, 500)));
  }
  if (channel === "WHATSAPP" && !templateName) {
    return NextResponse.json(
      { error: "WhatsApp templates need the approved Meta template name" },
      { status: 400 }
    );
  }
  const row = await db.messageTemplate.upsert({
    where: { organizationId_key_channel: { organizationId: orgId, key, channel } },
    update: { subject, body: text, templateName, bodyParams },
    create: { organizationId: orgId, key, channel, subject, body: text, templateName, bodyParams },
  });
  return NextResponse.json({ template: row });
}

/** Reset a template back to the built-in default. */
export async function DELETE(req: NextRequest) {
  const auth = await requireOrgApiUser(req, [...MANAGERS]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  const channel = url.searchParams.get("channel") || "";
  if (!validKeyChannel(key, channel)) {
    return NextResponse.json({ error: "Unknown template or channel" }, { status: 400 });
  }
  await db.messageTemplate
    .delete({
      where: { organizationId_key_channel: { organizationId: orgId, key, channel } },
    })
    .catch(() => null);
  return NextResponse.json({ reset: true });
}
