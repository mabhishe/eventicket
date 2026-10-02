import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";
import {
  claimEntry,
  familyCodeMessage,
  orderAllowsEntry,
  partyProgress,
  partyRoster,
  resolveScanCode,
  scanTicketInclude,
  unpaidOrderMessage,
} from "@/lib/door";

/**
 * Door check-in. A personal ticket code admits that person. A family
 * payment code returns the roster so staff can pick who is standing there.
 * Two phones scanning the same personal code cannot both succeed.
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
    return NextResponse.json({
      choosePerson: true,
      ticket: null,
      party,
      roster,
      message: familyCodeMessage("entry"),
    });
  }

  const ticket = resolved.ticket;
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

  const won = await claimEntry(ticket.id);
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
      message: `${name} is already in`,
    });
  }

  const updated = await db.ticket.findUnique({
    where: { id: ticket.id },
    include: scanTicketInclude,
  });
  const newParty = await partyProgress(info.id);
  const name = updated?.holderName || ticket.order.buyerName;
  return NextResponse.json({
    ticket: updated,
    already: false,
    party: newParty,
    roster: await partyRoster(info.id),
    message: `Admitted: ${name} — ${newParty.checkedIn} of ${newParty.total} in`,
  });
}
