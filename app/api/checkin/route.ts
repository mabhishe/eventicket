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
 * Door check-in, group-aware:
 * - a per-ticket code checks in that ticket (unchanged behavior);
 * - an order refCode (the group pass) checks in the next pending ticket of
 *   that order, so one QR admits a whole party one scan at a time.
 * Responses carry party progress { total, checkedIn, ... } and the full
 * per-person roster so staff can see exactly who was admitted.
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

  const resolved = await resolveScanCode(raw, "entry");
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
    return NextResponse.json({
      ticket: null,
      already: true,
      partyFull: true,
      party,
      roster,
      message: `Everyone is already in (${party.checkedIn} of ${party.total})`,
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
  if (ticket.status === "CHECKED_IN") {
    const name = ticket.holderName || ticket.order.buyerName;
    return NextResponse.json({
      ticket,
      already: true,
      party,
      roster,
      message: `${name} is already in`,
    });
  }

  const updated = await db.ticket.update({
    where: { id: ticket.id },
    data: { status: "CHECKED_IN", checkedInAt: new Date() },
    include: scanTicketInclude,
  });
  const newParty = await partyProgress(info.id);
  const name = updated.holderName || updated.order.buyerName;
  return NextResponse.json({
    ticket: updated,
    already: false,
    party: newParty,
    roster: await partyRoster(info.id),
    message: `Admitted: ${name} — ${newParty.checkedIn} of ${newParty.total} in`,
  });
}
