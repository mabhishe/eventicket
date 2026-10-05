import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { db } from "@/lib/db";
import {
  orderConfirmationHtml,
  appUrl,
} from "@/lib/email";
import {
  normalizePhone,
} from "@/lib/whatsapp";
import {
  sendTemplatedEmail,
  sendTemplatedWhatsApp,
  orderVars,
  orderReceivedWaFallback,
} from "@/lib/messaging";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { goldSponsorEmailHtml } from "@/lib/sponsorEmail";

// Seat-squatting protection: 10 orders per hour per IP.
const ORDER_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };

/** Public endpoint: a guest places an order (status PENDING_PAYMENT). */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`order:${clientIp(req)}`, ORDER_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many orders. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
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
      const org = event.organizationId
        ? await db.organization.findUnique({
            where: { id: event.organizationId },
            select: { id: true, name: true },
          })
        : null;
      const orgId = org?.id || "";
      const vars = orderVars(
        {
          id: order.id,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          refCode: order.refCode,
          entryCode: null,
          totalCents: order.totalCents,
          payMethod: order.payMethod,
        },
        {
          id: event.id,
          slug: event.slug,
          title: event.title,
          date: event.date,
          venue: event.venue,
          currency: event.currency,
          etransferEmail: event.etransferEmail,
          zelleHandle: event.zelleHandle,
        },
        org?.name || ""
      );
      if (order.buyerEmail && orgId) {
        try {
          await sendTemplatedEmail({
            organizationId: orgId,
            templateKey: "ORDER_RECEIVED",
            to: order.buyerEmail,
            vars,
            eventId: event.id,
            orderId: order.id,
            kind: "TEMPLATE",
            sponsorHtml: goldSponsorEmailHtml(
              await db.sponsorAd.findMany({
                where: { eventId: event.id, tier: "GOLD" },
              })
            ),
            // Rich default kept until the org customizes the template.
            richHtml: orderConfirmationHtml(
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
              `${appUrl()}/order/${order.id}`
            ),
          });
        } catch (e) {
          console.error("[orders] confirmation email failed", e instanceof Error ? e.message : e);
        }
      }
      const waTo = normalizePhone(order.buyerPhone);
      if (waTo && orgId) {
        try {
          await sendTemplatedWhatsApp({
            organizationId: orgId,
            templateKey: "ORDER_RECEIVED",
            to: waTo,
            vars,
            eventId: event.id,
            orderId: order.id,
            kind: "TEMPLATE",
            fallback: orderReceivedWaFallback(
              {
                id: order.id,
                buyerName: order.buyerName,
                refCode: order.refCode,
                totalCents: order.totalCents,
                payMethod: order.payMethod,
              },
              {
                id: event.id,
                slug: event.slug,
                title: event.title,
                date: event.date,
                venue: event.venue,
                currency: event.currency,
                etransferEmail: event.etransferEmail,
                zelleHandle: event.zelleHandle,
              },
              waTo
            ),
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
