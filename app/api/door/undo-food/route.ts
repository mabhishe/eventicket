import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { partyProgress, partyRoster } from "@/lib/door";

/** Staff correction: undo an accidental food scan for one ticket. */
export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN", "DOOR"]);
  if (!auth.ok) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const ticketId = String(body.ticketId || "");
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, orderId: true, foodCollectedAt: true, holderName: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!ticket.foodCollectedAt) {
    return NextResponse.json(
      { error: "No meal was recorded for this ticket" },
      { status: 400 }
    );
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: { foodCollectedAt: null },
  });

  const party = await partyProgress(ticket.orderId);
  return NextResponse.json({
    ok: true,
    message: `Undone — ${ticket.holderName || "guest"}'s meal is marked as not served`,
    party,
    roster: await partyRoster(ticket.orderId),
  });
}
