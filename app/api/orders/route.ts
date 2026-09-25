import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { db } from "@/lib/db";
import {
  sendEmail,
  orderConfirmationHtml,
  appUrl,
} from "@/lib/email";
import {
  sendWhatsAppTemplate,
  normalizePhone,
  orderTemplateName,
} from "@/lib/whatsapp";
import { formatCents } from "@/lib/money";

/** Public endpoint: a guest places an order (status PENDING_PAYMENT). */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const eventId = String(body.eventId || "");
  const items = body.items;
  const payMethod = String(body.payMethod || "");
  if (!eventId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Please select at least one ticket" },
      { status: 400 }
    );
  }
  if (!["ETRANSFER", "ZELLE", "CASH"].includes(payMethod)) {
    return NextResponse.json(
      { error: "Please choose a payment method" },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder({
      eventId,
      buyerName: String(body.buyerName || ""),
      buyerEmail: String(body.buyerEmail || "").trim() || undefined,
      buyerPhone: String(body.buyerPhone || "").trim() || undefined,
      payMethod: payMethod as "ETRANSFER" | "ZELLE" | "CASH",
      notes: String(body.notes || "").trim() || undefined,
      inviteCode: String(body.inviteCode || "").trim() || undefined,
      showOnWall: body.showOnWall === true,
      items: items.map((it: Record<string, unknown>) => ({
        ticketTypeId: String(it.ticketTypeId),
        qty: Number(it.qty),
        mealOptionId: it.mealOptionId ? String(it.mealOptionId) : null,
        holderName: it.holderName ? String(it.holderName) : null,
      })),
    });
    // Confirmation email + WhatsApp (never fail the order).
    const event = await db.event.findUnique({ where: { id: order.eventId } });
    if (event) {
      const orderUrl = `${appUrl()}/order/${order.id}`;
      const dateLabel = new Intl.DateTimeFormat("en-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(event.date));
      if (order.buyerEmail) {
        try {
          await sendEmail({
            to: order.buyerEmail,
            subject: `Order received — ${event.title}`,
            html: orderConfirmationHtml(
              {
                id: order.id,
                buyerName: order.buyerName,
                buyerEmail: order.buyerEmail,
                payMethod: order.payMethod,
                refCode: order.refCode,
                totalCents: order.totalCents,
                currency: event.currency,
                items: order.items.map((it) => ({
                  qty: it.qty,
                  name: it.ticketType.name,
                  holderName: it.holderName,
                })),
              },
              event,
              orderUrl
            ),
          });
        } catch (e) {
          console.error("[orders] confirmation email failed", e instanceof Error ? e.message : e);
        }
      }
      const waTo = normalizePhone(order.buyerPhone);
      if (waTo) {
        try {
          const total = formatCents(order.totalCents, event.currency);
          const payLine =
            order.payMethod === "ETRANSFER" && event.etransferEmail
              ? `send ${total} by Interac e-Transfer to ${event.etransferEmail}`
              : order.payMethod === "ZELLE" && event.zelleHandle
                ? `send ${total} by Zelle to ${event.zelleHandle}`
                : order.payMethod === "CASH" && event.cashNote
                  ? event.cashNote
                  : `pay ${total} as instructed by the organizer`;
          await sendWhatsAppTemplate({
            to: waTo,
            template: orderTemplateName(),
            bodyParams: [
              order.buyerName.split(" ")[0],
              event.title,
              dateLabel,
              total,
              payLine,
              order.refCode || "—",
            ],
          });
        } catch (e) {
          console.error("[orders] WhatsApp confirmation failed", e instanceof Error ? e.message : e);
        }
      }
    }
    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not place order" },
      { status: 400 }
    );
  }
}
