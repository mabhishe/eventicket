import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendTemplatedEmail,
  sendTemplatedWhatsApp,
  orderVars,
} from "@/lib/messaging";

/**
 * Cron dispatcher for the messaging center. Call hourly, e.g.:
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" https://events.example.com/api/cron/reminders
 *
 * Requires CRON_SECRET env to match. Does two jobs:
 *  1. Scheduled event reminders — fires each enabled ScheduledReminder once
 *     per confirmed order when (event.start - offsetMinutes) has passed.
 *  2. Nightly payment nudges — after 8pm in the org's timezone, emails every
 *     PENDING_PAYMENT order (unpaid, non-zero total, event in the future)
 *     that hasn't been nudged in the last 20 hours.
 *
 * Email sending is skipped gracefully when Resend is unconfigured; WhatsApp
 * reminders only send when the org configured a custom WhatsApp template
 * (Meta requires pre-approved templates for proactive messages).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let remindersSent = 0;
  let nudgesSent = 0;

  // --- Job 1: scheduled event reminders ---
  const due = await db.scheduledReminder.findMany({
    where: { enabled: true, event: { date: { gt: now } } },
    include: {
      event: true,
      organization: { select: { id: true, name: true } },
    },
  });
  for (const r of due) {
    const sendAt = new Date(r.event.date.getTime() - r.offsetMinutes * 60000);
    if (sendAt > now) continue;
    const orders = await db.order.findMany({
      where: { eventId: r.eventId, status: "CONFIRMED" },
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        buyerPhone: true,
        refCode: true,
        totalCents: true,
      },
    });
    for (const order of orders) {
      const already = await db.messageLog.findFirst({
        where: { kind: "REMINDER", templateKey: r.id, orderId: order.id, status: "SENT" },
      });
      if (already) continue;
      const vars = orderVars(
        {
          id: order.id,
          buyerName: order.buyerName,
          refCode: order.refCode,
          entryCode: order.refCode,
          totalCents: order.totalCents,
        },
        {
          id: r.event.id,
          slug: r.event.slug,
          title: r.event.title,
          date: r.event.date,
          venue: r.event.venue,
          currency: r.event.currency,
        },
        r.organization.name
      );
      if (r.channel === "EMAIL" && order.buyerEmail) {
        const sent = await sendTemplatedEmail({
          organizationId: r.organizationId,
          templateKey: "EVENT_REMINDER",
          to: order.buyerEmail,
          vars,
          eventId: r.eventId,
          orderId: order.id,
          kind: "REMINDER",
        }).catch(() => false);
        if (sent) remindersSent++;
      } else if (r.channel === "WHATSAPP" && order.buyerPhone) {
        const sent = await sendTemplatedWhatsApp({
          organizationId: r.organizationId,
          templateKey: "EVENT_REMINDER",
          to: order.buyerPhone,
          vars,
          eventId: r.eventId,
          orderId: order.id,
          kind: "REMINDER",
        }).catch(() => false);
        if (sent) remindersSent++;
      }
    }
  }

  // --- Job 2: nightly payment nudges (8pm org-local) ---
  const orgs = await db.organization.findMany({
    select: { id: true, name: true, timezone: true },
  });
  for (const org of orgs) {
    const tz = org.timezone || "America/Toronto";
    let hour = -1;
    try {
      hour = Number(
        new Intl.DateTimeFormat("en-CA", {
          hour: "numeric",
          hour12: false,
          timeZone: tz,
        }).format(now)
      );
    } catch {
      continue;
    }
    if (hour < 20) continue;
    const pending = await db.order.findMany({
      where: {
        status: "PENDING_PAYMENT",
        totalCents: { gt: 0 },
        event: { organizationId: org.id, date: { gt: now } },
      },
      include: { event: true },
    });
    for (const order of pending) {
      const nudged = await db.messageLog.findFirst({
        where: {
          kind: "PAYMENT_NUDGE",
          orderId: order.id,
          status: "SENT",
          sentAt: { gt: new Date(now.getTime() - 20 * 3600 * 1000) },
        },
      });
      if (nudged) continue;
      const vars = orderVars(
        {
          id: order.id,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          refCode: order.refCode,
          totalCents: order.totalCents,
          payMethod: order.payMethod,
        },
        {
          id: order.event.id,
          slug: order.event.slug,
          title: order.event.title,
          date: order.event.date,
          venue: order.event.venue,
          currency: order.event.currency,
          etransferEmail: order.event.etransferEmail,
        },
        org.name
      );
      if (order.buyerEmail) {
        const sent = await sendTemplatedEmail({
          organizationId: org.id,
          templateKey: "PAYMENT_REMINDER",
          to: order.buyerEmail,
          vars,
          eventId: order.event.id,
          orderId: order.id,
          kind: "PAYMENT_NUDGE",
        }).catch(() => false);
        if (sent) nudgesSent++;
      }
      if (order.buyerPhone) {
        const sent = await sendTemplatedWhatsApp({
          organizationId: org.id,
          templateKey: "PAYMENT_REMINDER",
          to: order.buyerPhone,
          vars,
          eventId: order.event.id,
          orderId: order.id,
          kind: "PAYMENT_NUDGE",
        }).catch(() => false);
        if (sent) nudgesSent++;
      }
    }
  }

  return NextResponse.json({ ok: true, remindersSent, nudgesSent });
}
