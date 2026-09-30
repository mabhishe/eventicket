import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { orderVars, renderVars } from "@/lib/messaging";
import { shell } from "@/lib/email";
import { sendEmail } from "@/lib/email";

const MANAGERS = ["ORG_OWNER", "ORG_ADMIN"] as const;

/**
 * Mass message: one email to every buyer with a CONFIRMED order for an event.
 * Each email is personalized with the buyer's own variables. Rate-limited and
 * logged; WhatsApp is not supported for freeform broadcasts (Meta requires
 * pre-approved templates for proactive messages).
 */
export async function POST(req: NextRequest) {
  const auth = await requireOrgApiUser(req, [...MANAGERS]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

  const rl = checkRateLimit(`broadcast:${orgId}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Broadcast limit reached (3 per hour). Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = String(body?.eventId || "");
  const subject = String(body?.subject || "").slice(0, 200).trim();
  const text = String(body?.body || "");
  if (text.length > 20000 || text.trim().length === 0) {
    return NextResponse.json({ error: "Body must be 1–20,000 characters" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  const event = eventId
    ? await db.event.findFirst({ where: { id: eventId, organizationId: orgId } })
    : null;
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const org = await db.organization.findUnique({ where: { id: orgId } });

  const orders = await db.order.findMany({
    where: {
      eventId: event.id,
      status: "CONFIRMED",
      buyerEmail: { not: null },
    },
    select: {
      id: true,
      buyerName: true,
      buyerEmail: true,
      refCode: true,
      totalCents: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  // Reuse the templated sender's logging by going through a tiny wrapper:
  // each broadcast email is personalized per order.
  for (const order of orders) {
    if (!order.buyerEmail) {
      skipped++;
      continue;
    }
    const vars = orderVars(
      {
        id: order.id,
        buyerName: order.buyerName,
        refCode: order.refCode,
        entryCode: order.refCode, // group entry code == refCode once confirmed
        totalCents: order.totalCents,
      },
      {
        id: event.id,
        slug: event.slug,
        title: event.title,
        date: event.date,
        venue: event.venue,
        currency: event.currency,
      },
      org?.name || ""
    );
    const html = shell({
      accent: "#c2410c",
      preheader: renderVars(subject, vars),
      body: renderVars(text, vars),
    });
    try {
      const ok = await sendEmail({
        to: order.buyerEmail,
        subject: renderVars(subject, vars),
        html,
      });
      await db.messageLog.create({
        data: {
          organizationId: orgId,
          eventId: event.id,
          orderId: order.id,
          kind: "BROADCAST",
          channel: "EMAIL",
          recipient: order.buyerEmail,
          status: ok ? "SENT" : "SKIPPED",
        },
      });
      if (ok) sent++;
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return NextResponse.json({ sent, skipped, total: orders.length });
}
