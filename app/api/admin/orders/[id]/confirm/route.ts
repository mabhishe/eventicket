import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { issueTickets, ensureOrderRefCode } from "@/lib/orders";
import {
  sendEmail,
  ticketsIssuedHtml,
  orderQrPngBuffer,
  appUrl,
} from "@/lib/email";

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
  // Tickets email with the group QR + entry code (never fails the confirm).
  try {
    const full = await db.order.findUnique({
      where: { id },
      include: {
        event: true,
        items: { include: { ticketType: true } },
      },
    });
    if (full?.buyerEmail && full.event) {
      const groupCode = await ensureOrderRefCode(id);
      const qr = await orderQrPngBuffer(groupCode);
      await sendEmail({
        to: full.buyerEmail,
        subject: `You're in! Tickets for ${full.event.title}`,
        html: ticketsIssuedHtml(
          {
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
          },
          full.event,
          groupCode,
          `${appUrl()}/order/${full.id}`
        ),
        attachments: [
          { filename: `group-qr-${groupCode}.png`, content: qr.toString("base64") },
        ],
      });
    }
  } catch (e) {
    console.error("[confirm] tickets email failed", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ order: updated, tickets });
}
