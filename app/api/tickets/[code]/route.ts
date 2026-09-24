import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractCode } from "@/lib/tickets";

type Ctx = { params: Promise<{ code: string }> };

/** Public ticket lookup (limited fields) — powers the /t/[code] page. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { code } = await params;
  const ticket = await db.ticket.findUnique({
    where: { code: extractCode(code) },
    include: {
      ticketType: { select: { name: true } },
      mealOption: { select: { name: true } },
      order: {
        select: {
          buyerName: true,
          status: true,
          event: {
            select: {
              title: true,
              date: true,
              venue: true,
              slug: true,
            },
          },
        },
      },
    },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  return NextResponse.json({ ticket });
}
