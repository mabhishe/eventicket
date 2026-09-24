import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import {
  resolveScanCode,
  partyProgress,
  partyRoster,
  scanTicketInclude,
} from "@/lib/door";

/**
 * Food service, group-aware:
 * - a per-ticket code records that ticket's meal as served (unchanged);
 * - an order refCode (the group pass) serves the next unserved meal of that
 *   order and reports which meal it was, so one QR works for the whole party.
 * Responses carry party progress { mealsTotal, mealsServed, ... } and the
 * full per-person roster.
 * When the event requires entry before food, unadmitted guests are refused.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN", "DOOR"]);
  if (!auth.ok) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const raw = String(body.code || "");
  const eventId = String(body.eventId || "");
  if (!raw) {
    return NextResponse.json({ error: "Ticket code required" }, { status: 400 });
  }

  const resolved = await resolveScanCode(raw, "food");
  if (resolved.kind === "none") {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }

  const info =
    resolved.kind === "ticket"
      ? {
          id: resolved.ticket.order.id,
          title: resolved.ticket.order.event.title,
          status: resolved.ticket.order.status,
          eventId: resolved.ticket.order.eventId,
        }
      : {
          id: resolved.orderId,
          title: resolved.orderTitle,
          status: resolved.orderStatus,
          eventId: resolved.orderEventId,
        };

  if (eventId && info.eventId !== eventId) {
    return NextResponse.json(
      { error: `This code is for "${info.title}", not this event` },
      { status: 400 }
    );
  }
  if (info.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "This order is not confirmed yet" },
      { status: 400 }
    );
  }

  const party = await partyProgress(info.id);
  const roster = await partyRoster(info.id);
  if (resolved.kind === "order" && !resolved.nextTicket) {
    if (party.mealsTotal === 0) {
      return NextResponse.json(
        { error: "This order does not include any meals", party, roster },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ticket: null,
      already: true,
      partyFull: true,
      party,
      roster,
      message: `All meals already served (${party.mealsServed} of ${party.mealsTotal})`,
    });
  }

  const ticket =
    resolved.kind === "ticket" ? resolved.ticket : resolved.nextTicket!;
  if (ticket.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Ticket was cancelled", party, roster },
      { status: 400 }
    );
  }
  if (!ticket.mealOptionId) {
    return NextResponse.json(
      { error: "This ticket does not include a meal", ticket, party, roster },
      { status: 400 }
    );
  }
  if (ticket.foodCollectedAt) {
    const name = ticket.holderName || ticket.order.buyerName;
    return NextResponse.json({
      ticket,
      already: true,
      party,
      roster,
      message: `${name} already collected their meal`,
    });
  }

  // Per-event option: the food line only serves guests who entered first.
  const event = await db.event.findUnique({
    where: { id: info.eventId },
    select: { requireEntryBeforeFood: true },
  });
  if (event?.requireEntryBeforeFood && ticket.status !== "CHECKED_IN") {
    const name = ticket.holderName || ticket.order.buyerName;
    return NextResponse.json(
      {
        error: `Not checked in yet — ${name} needs to be admitted at Entry first`,
        ticket,
        party,
        roster,
      },
      { status: 409 }
    );
  }

  const updated = await db.ticket.update({
    where: { id: ticket.id },
    data: { foodCollectedAt: new Date() },
    include: scanTicketInclude,
  });
  const newParty = await partyProgress(info.id);
  const name = updated.holderName || updated.order.buyerName;
  const meal = updated.mealOption?.name || "meal";
  return NextResponse.json({
    ticket: updated,
    already: false,
    party: newParty,
    roster: await partyRoster(info.id),
    message: `Served: ${meal} to ${name} — ${newParty.mealsServed} of ${newParty.mealsTotal} served`,
  });
}
