import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { issueTickets, ensureOrderRefCode } from "@/lib/orders";
import {
  sendEmail,
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
  const auth = await requireApiUser(req, ["ADMIN", "SELLER"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  const order = await db.order.findUnique({ where: { id } });
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
        await sendEmail({
          to: full.buyerEmail,
          subject: `You're in! Tickets for ${full.event.title}`,
          html: ticketsIssuedHtml(mailInfo, full.event, groupCode, orderUrl),
          attachments: [
            { filename: `group-qr-${groupCode}.png`, content: qr.toString("base64") },
          ],
        });
      }
      const waTo = normalizePhone(full.buyerPhone);
      if (waTo) {
        await sendWhatsAppTemplate({
          to: waTo,
          template: ticketsTemplateName(),
          ...(qrImageUrl ? { headerImageUrl: qrImageUrl } : {}),
          bodyParams: [
            full.buyerName.split(" ")[0],
            full.event.title,
            groupCode,
          ],
        });
      }
    }
  } catch (e) {
    console.error("[confirm] tickets notifications failed", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ order: updated, tickets });
}
