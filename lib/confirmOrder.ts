import { promises as fs } from "fs";
import path from "path";
import { db } from "./db";
import { issueTickets, ensureOrderRefCode, ensureOrderInviteCode } from "./orders";
import { formatCents, summarizePayments } from "./money";
import {
  sendTemplatedEmail,
  sendTemplatedWhatsApp,
  orderVars,
} from "./messaging";
import {
  ticketsIssuedHtml,
  orderQrPngBuffer,
  appUrl,
  buyerInviteEmailBlock,
} from "./email";
import { goldSponsorEmailHtml } from "./sponsorEmail";
import {
  sendWhatsAppTemplate,
  normalizePhone,
  ticketsTemplateName,
} from "./whatsapp";

export type ConfirmOrderResult =
  | {
      ok: true;
      already: boolean;
      order: NonNullable<Awaited<ReturnType<typeof db.order.findUnique>>>;
      tickets: Awaited<ReturnType<typeof issueTickets>>;
    }
  | { ok: false; error: string; status: number };

/**
 * Mark a PENDING_PAYMENT order CONFIRMED and issue tickets + notifications.
 * Shared by the admin Confirm button and the payment-intake webhook.
 * confirmedById may be null when the confirm was automated.
 */
export async function confirmPendingOrder(opts: {
  orderId: string;
  orgId: string;
  confirmedById?: string | null;
}): Promise<ConfirmOrderResult> {
  const { orderId: id, orgId } = opts;
  const confirmedById = opts.confirmedById ?? null;

  const order = await db.order.findFirst({
    where: { id, event: { organizationId: orgId } },
    include: { payments: true, event: { select: { currency: true } } },
  });
  if (!order) {
    return { ok: false, error: "Order not found", status: 404 };
  }
  if (order.status === "CONFIRMED") {
    const tickets = await issueTickets(id);
    return { ok: true, already: true, order, tickets };
  }
  if (order.status !== "PENDING_PAYMENT") {
    return { ok: false, error: `Order is ${order.status}`, status: 400 };
  }

  const sum = summarizePayments(order.payments, order.totalCents);
  if (!sum.canConfirm) {
    return {
      ok: false,
      error: `Recorded payment is ${formatCents(sum.net, order.event.currency)} of ${formatCents(order.totalCents, order.event.currency)}. This order stays pending until the rest arrives.`,
      status: 400,
    };
  }

  const claimed = await db.order.updateMany({
    where: { id, status: "PENDING_PAYMENT" },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmedById,
    },
  });
  if (claimed.count === 0) {
    const tickets = await issueTickets(id);
    const current = await db.order.findUnique({ where: { id } });
    if (!current) {
      return { ok: false, error: "Order not found", status: 404 };
    }
    return { ok: true, already: true, order: current, tickets };
  }
  const updated = await db.order.findUnique({ where: { id } });
  if (!updated) {
    return { ok: false, error: "Order not found", status: 404 };
  }
  const tickets = await issueTickets(id);

  try {
    const full = await db.order.findUnique({
      where: { id },
      include: {
        event: true,
        items: { include: { ticketType: true } },
      },
    });
    if (full?.event) {
      const groupCode = await ensureOrderRefCode(id);
      const inviteCode = full.inviteCode || (await ensureOrderInviteCode(id));
      const qr = await orderQrPngBuffer(groupCode);
      const orderUrl = `${appUrl()}/order/${full.id}`;
      let qrImageUrl: string | null = null;
      try {
        const qrDir = path.join(process.cwd(), "public", "uploads", "qr");
        await fs.mkdir(qrDir, { recursive: true });
        await fs.writeFile(path.join(qrDir, `${full.id}.png`), qr);
        const base = appUrl();
        if (base) qrImageUrl = `${base}/uploads/qr/${full.id}.png`;
      } catch (e) {
        console.error("[confirm] QR file write failed", e instanceof Error ? e.message : e);
      }
      const mailInfo = {
        id: full.id,
        buyerName: full.buyerName,
        buyerEmail: full.buyerEmail,
        payMethod: full.payMethod,
        refCode: full.refCode,
        totalCents: full.totalCents,
        currency: full.event.currency,
        items: full.items.map((it) => ({
          qty: it.qty,
          name: it.ticketType.name,
          holderName: it.holderName,
        })),
      };
      if (full.buyerEmail) {
        const org = await db.organization.findUnique({
          where: { id: orgId },
          select: { id: true, name: true },
        });
        await sendTemplatedEmail({
          organizationId: orgId,
          templateKey: "TICKETS_ISSUED",
          to: full.buyerEmail,
          vars: orderVars(
            {
              id: full.id,
              buyerName: full.buyerName,
              buyerEmail: full.buyerEmail,
              buyerPhone: full.buyerPhone,
              refCode: full.refCode,
              entryCode: groupCode,
              inviteCode,
              totalCents: full.totalCents,
            },
            {
              id: full.event.id,
              slug: full.event.slug,
              title: full.event.title,
              date: full.event.date,
              timezone: full.event.timezone,
              venue: full.event.venue,
              description: full.event.description,
              currency: full.event.currency,
            },
            org?.name || ""
          ),
          eventId: full.event.id,
          orderId: full.id,
          kind: "TEMPLATE",
          sponsorHtml:
            buyerInviteEmailBlock({
              slug: full.event.slug,
              inviteCode,
              title: full.event.title,
              date: full.event.date,
              venue: full.event.venue,
              description: full.event.description,
              timezone: full.event.timezone,
            }) +
            goldSponsorEmailHtml(
              await db.sponsorAd.findMany({
                where: { eventId: full.event.id, tier: "GOLD" },
              })
            ),
          richHtml: ticketsIssuedHtml(
            mailInfo,
            full.event,
            groupCode,
            orderUrl,
            tickets.map((t) => ({ code: t.code, holderName: t.holderName }))
          ),
        });
      }
      const waTo = normalizePhone(full.buyerPhone);
      if (waTo) {
        const org = await db.organization.findUnique({
          where: { id: orgId },
          select: { name: true },
        });
        await sendTemplatedWhatsApp({
          organizationId: orgId,
          templateKey: "TICKETS_ISSUED",
          to: waTo,
          vars: orderVars(
            {
              id: full.id,
              buyerName: full.buyerName,
              refCode: full.refCode,
              entryCode: groupCode,
              inviteCode,
              totalCents: full.totalCents,
            },
            {
              id: full.event.id,
              slug: full.event.slug,
              title: full.event.title,
              date: full.event.date,
              timezone: full.event.timezone,
              venue: full.event.venue,
              description: full.event.description,
              currency: full.event.currency,
            },
            org?.name || ""
          ),
          eventId: full.event.id,
          orderId: full.id,
          kind: "TEMPLATE",
          fallback: async () =>
            sendWhatsAppTemplate({
              to: waTo,
              template: ticketsTemplateName(),
              ...(qrImageUrl ? { headerImageUrl: qrImageUrl } : {}),
              bodyParams: [
                full.buyerName.split(" ")[0],
                full.event.title,
                groupCode,
              ],
            }),
        });
      }
    }
  } catch (e) {
    console.error("[confirm] tickets notifications failed", e instanceof Error ? e.message : e);
  }

  return { ok: true, already: false, order: updated, tickets };
}
