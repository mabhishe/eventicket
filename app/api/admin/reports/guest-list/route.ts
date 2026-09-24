import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

function cell(v: string | null | undefined): string {
  let s = v ?? "";
  // Guard against CSV formula injection.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** ADMIN: download the guest list for an event as CSV. */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const tickets = await db.ticket.findMany({
    where: { order: { eventId, status: "CONFIRMED" }, status: { not: "CANCELLED" } },
    orderBy: [{ ticketType: { sortOrder: "asc" } }, { createdAt: "asc" }],
    include: {
      ticketType: { select: { name: true } },
      mealOption: { select: { name: true, tag: true } },
      order: { select: { buyerName: true, buyerEmail: true, buyerPhone: true } },
    },
  });

  const rows: string[] = [
    [
      "Holder name",
      "Ticket type",
      "Meal",
      "Diet",
      "Checked in",
      "Check-in time",
      "Food collected",
      "Food time",
      "Buyer name",
      "Buyer email",
      "Buyer phone",
      "Ticket code",
    ].join(","),
  ];
  for (const t of tickets) {
    rows.push(
      [
        cell(t.holderName),
        cell(t.ticketType.name),
        cell(t.mealOption?.name),
        cell(
          t.mealOption?.tag === "veg"
            ? "veg"
            : t.mealOption?.tag === "nonveg"
              ? "non-veg"
              : ""
        ),
        cell(t.status === "CHECKED_IN" ? "yes" : "no"),
        cell(t.checkedInAt ? new Date(t.checkedInAt).toISOString() : ""),
        cell(t.foodCollectedAt ? "yes" : "no"),
        cell(t.foodCollectedAt ? new Date(t.foodCollectedAt).toISOString() : ""),
        cell(t.order.buyerName),
        cell(t.order.buyerEmail),
        cell(t.order.buyerPhone),
        cell(t.code),
      ].join(",")
    );
  }

  const filename = `${event.slug}-guests.csv`;
  return new NextResponse("\uFEFF" + rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
