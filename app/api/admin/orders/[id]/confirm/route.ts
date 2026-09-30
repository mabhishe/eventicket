import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import { issueTickets, ensureOrderRefCode } from "@/lib/orders";
import {
  sendTemplatedEmail,
  sendTemplatedWhatsApp,
  orderVars,
} from "@/lib/messaging";
import {
  ticketsIssuedHtml,
  orderQrPngBuffer,
  appUrl,
} from "@/lib/email";
import {
  sendWhatsAppTemplate,
  normalizePhone,
  ticketsTemplateName,
} from "@/lib/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

/** Mark a PENDING_PAYMENT order CONFIRMED and issue its tickets. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_STAFF"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id, event: { organizationId: orgId } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "CONFIRMED") {
    const tickets = await issueTickets(id); // idempotent
    return NextResponse.json({ order, tickets, already: true });
  }
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: `Order is ${order.status}` },
      { status: 400 }
    );
  }

  const updated = await db.order.update({
    where: { id },
    data: { status: "CONFIRMED" },
  });
  const tickets = await issueTickets(id);
  // Tickets notifications: email (QR attached) + WhatsApp (QR as image).
  // Neither may fail the confirmation.
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
      const qr = await orderQrPngBuffer(groupCode);
      const orderUrl = `${appUrl()}/order/${full.id}`;
      // Public QR image for the WhatsApp template's image header.
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
              totalCents: full.totalCents,
            },
            {
              id: full.event.id,
              slug: full.event.slug,
              title: full.event.title,
              date: full.event.date,
              venue: full.event.venue,
              currency: full.event.currency,
            },
            org?.name || ""
          ),
          eventId: full.event.id,
          orderId: full.id,
          kind: "TEMPLATE",
          // Rich default (with QR attached) kept until the org customizes.
          richHtml: ticketsIssuedHtml(mailInfo, full.event, groupCode, orderUrl),
          attachments: [
            { filename: `group-qr-${groupCode}.png`, content: qr.toString("base64") },
          ],
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
              totalCents: full.totalCents,
            },
            {
              id: full.event.id,
              slug: full.event.slug,
              title: full.event.title,
              date: full.event.date,
              venue: full.event.venue,
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
  return NextResponse.json({ order: updated, tickets });
}
