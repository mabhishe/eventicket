import { db } from "./db";
import { sendEmail } from "./email";
import {
  DIGEST_HOUR,
  digestHasNews,
  digestHtml,
  digestRecipients,
  localClock,
  localDayStart,
  toDigestOrder,
} from "./organizerDigest";

const orderInclude = {
  event: { select: { title: true, currency: true } },
  items: { select: { qty: true } },
  payments: { select: { kind: true, amountCents: true } },
} as const;

/**
 * One email per organization at 10:00 p.m. in that org's timezone.
 * The hourly cron calls this. A missed 10 p.m. run still sends at 11 p.m.,
 * and a failed send is retried on the next run the same night.
 * A quiet night (nobody registered, nobody paid, nobody waiting) sends nothing.
 */
export async function sendOrganizerDaySummaries(now = new Date()): Promise<number> {
  const orgs = await db.organization.findMany({
    select: {
      id: true,
      name: true,
      timezone: true,
      supportEmail: true,
      memberships: {
        where: { role: { in: ["ORG_OWNER", "ORG_ADMIN"] } },
        select: { user: { select: { email: true } } },
      },
    },
  });

  let sentCount = 0;
  for (const org of orgs) {
    const tz = org.timezone || "America/Toronto";
    const clock = localClock(now, tz);
    const dayStart = localDayStart(now, tz);
    if (!clock || !dayStart || clock.hour < DIGEST_HOUR) continue;

    const recipients = digestRecipients(
      org.memberships.map((m) => m.user.email),
      org.supportEmail
    );
    if (recipients.length === 0) continue;

    const already = await db.messageLog.findMany({
      where: {
        organizationId: org.id,
        kind: "DAY_SUMMARY",
        channel: "EMAIL",
        templateKey: clock.dateKey,
        status: "SENT",
        recipient: { in: recipients },
      },
      select: { recipient: true },
    });
    const done = new Set(already.map((row) => row.recipient.toLowerCase()));
    const pending = recipients.filter((email) => !done.has(email.toLowerCase()));
    if (pending.length === 0) continue;

    const [registeredRows, paidRows, waitingRows] = await Promise.all([
      db.order.findMany({
        where: {
          status: { not: "CANCELLED" },
          createdAt: { gte: dayStart, lte: now },
          event: { organizationId: org.id },
        },
        include: orderInclude,
        orderBy: { createdAt: "asc" },
      }),
      db.order.findMany({
        where: {
          status: "CONFIRMED",
          confirmedAt: { gte: dayStart, lte: now },
          event: { organizationId: org.id },
        },
        include: orderInclude,
        orderBy: { confirmedAt: "asc" },
      }),
      db.order.findMany({
        where: {
          status: "PENDING_PAYMENT",
          totalCents: { gt: 0 },
          event: { organizationId: org.id, date: { gt: now } },
        },
        include: orderInclude,
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const registered = registeredRows.map(toDigestOrder);
    const paid = paidRows.map(toDigestOrder);
    const waiting = waitingRows.map(toDigestOrder);
    if (!digestHasNews({ registered, paid, waiting })) continue;

    const { subject, html } = digestHtml({
      orgName: org.name,
      registered,
      paid,
      waiting,
    });

    for (const to of pending) {
      const sent = await sendEmail({ to, subject, html });
      await logDigest({
        organizationId: org.id,
        recipient: to,
        dateKey: clock.dateKey,
        status: sent ? "SENT" : "SKIPPED",
      });
      if (sent) sentCount += 1;
    }
  }
  return sentCount;
}

async function logDigest(opts: {
  organizationId: string;
  recipient: string;
  dateKey: string;
  status: "SENT" | "SKIPPED";
}) {
  try {
    await db.messageLog.create({
      data: {
        organizationId: opts.organizationId,
        kind: "DAY_SUMMARY",
        channel: "EMAIL",
        recipient: opts.recipient,
        templateKey: opts.dateKey,
        status: opts.status,
      },
    });
  } catch (e) {
    console.error("[digest] log failed", e instanceof Error ? e.message : e);
  }
}
