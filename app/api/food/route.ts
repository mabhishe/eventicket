import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import {
  claimFood,
  familyCodeMessage,
  orderAllowsEntry,
  partyProgress,
  partyRoster,
  resolveScanCode,
  scanTicketInclude,
  unpaidOrderMessage,
} from "@/lib/door";

/**
 * Food service. A personal ticket code serves that person's meal. A family
 * code returns the roster so staff pick who is at the window. Two phones
 * cannot both record the same meal.
 */
export async function POST(req: NextRequest) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN", "ORG_DOOR"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;

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
          emergencyAdmittedAt: resolved.ticket.order.emergencyAdmittedAt,
        }
      : {
          id: resolved.orderId,
          title: resolved.orderTitle,
          status: resolved.orderStatus,
          eventId: resolved.orderEventId,
          emergencyAdmittedAt: resolved.emergencyAdmittedAt,
        };

  const eventOk = await db.event.findFirst({
    where: { id: info.eventId, organizationId: orgId },
    select: { id: true },
  });
  if (!eventOk) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }
  if (eventId && info.eventId !== eventId) {
    return NextResponse.json(
      { error: `This code is for "${info.title}", not this event` },
      { status: 400 }
    );
  }
  if (!orderAllowsEntry(info)) {
    return NextResponse.json({ error: unpaidOrderMessage() }, { status: 400 });
  }

  const party = await partyProgress(info.id);
  const roster = await partyRoster(info.id);

  if (resolved.kind === "order") {
    if (party.mealsTotal === 0) {
      return NextResponse.json(
        { error: "This order does not include any meals", party, roster },
        { status: 400 }
      );
    }
    return NextResponse.json({
      choosePerson: true,
      ticket: null,
      party,
      roster,
      message: familyCodeMessage("food"),
    });
  }

  const ticket = resolved.ticket;
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

  const won = await claimFood(ticket.id);
  if (!won) {
    const current = await db.ticket.findUnique({
      where: { id: ticket.id },
      include: scanTicketInclude,
    });
    const name = current?.holderName || ticket.order.buyerName;
    return NextResponse.json({
      ticket: current,
      already: true,
      party: await partyProgress(info.id),
      roster: await partyRoster(info.id),
      message: `${name} already collected their meal`,
    });
  }

  const updated = await db.ticket.findUnique({
    where: { id: ticket.id },
    include: scanTicketInclude,
  });
  const newParty = await partyProgress(info.id);
  const name = updated?.holderName || ticket.order.buyerName;
  const meal = updated?.mealOption?.name || "meal";
  return NextResponse.json({
    ticket: updated,
    already: false,
    party: newParty,
    roster: await partyRoster(info.id),
    message: `Served: ${meal} to ${name} — ${newParty.mealsServed} of ${newParty.mealsTotal} served`,
  });
}
