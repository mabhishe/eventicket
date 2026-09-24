import { db } from "./db";
import { extractCode } from "./tickets";

/**
 * Shared resolution for door scans. A scan code can be:
 * - a per-ticket code (checks that specific ticket), or
 * - an order refCode — the group pass — which resolves to the next pending
 *   ticket of that order, so one QR admits a whole party one scan at a time.
 */
export const scanTicketInclude = {
  ticketType: { select: { name: true } },
  mealOption: { select: { name: true, tag: true } },
  order: {
    select: {
      id: true,
      buyerName: true,
      status: true,
      eventId: true,
      refCode: true,
      event: { select: { title: true } },
    },
  },
} as const;

export type ResolvedScanTicket = Awaited<
  ReturnType<typeof db.ticket.findFirst<{ include: typeof scanTicketInclude }>>
>;

export async function resolveScanCode(
  raw: string,
  mode: "entry" | "food"
): Promise<
  | { kind: "ticket"; ticket: NonNullable<ResolvedScanTicket> }
  | {
      kind: "order";
      orderId: string;
      orderEventId: string;
      orderTitle: string;
      orderStatus: string;
      nextTicket: NonNullable<ResolvedScanTicket> | null;
    }
  | { kind: "none" }
> {
  const code = extractCode(raw);

  const byTicket = await db.ticket.findFirst({
    where: { code },
    include: scanTicketInclude,
  });
  if (byTicket) return { kind: "ticket", ticket: byTicket };

  const order = await db.order.findUnique({
    where: { refCode: code },
    select: {
      id: true,
      status: true,
      eventId: true,
      event: { select: { title: true } },
    },
  });
  if (!order) return { kind: "none" };

  const nextTicket = await db.ticket.findFirst({
    where: {
      orderId: order.id,
      ...(mode === "entry"
        ? { status: { notIn: ["CANCELLED", "CHECKED_IN"] } }
        : {
            status: { not: "CANCELLED" },
            mealOptionId: { not: null },
            foodCollectedAt: null,
          }),
    },
    orderBy: { createdAt: "asc" },
    include: scanTicketInclude,
  });

  return {
    kind: "order",
    orderId: order.id,
    orderEventId: order.eventId,
    orderTitle: order.event.title,
    orderStatus: order.status,
    nextTicket,
  };
}

/** Party-level progress for an order: { total, checkedIn, mealsTotal, mealsServed }. */
export async function partyProgress(orderId: string) {
  const tickets = await db.ticket.findMany({
    where: { orderId, status: { not: "CANCELLED" } },
    select: { status: true, foodCollectedAt: true, mealOptionId: true },
  });
  const total = tickets.length;
  const checkedIn = tickets.filter((t) => t.status === "CHECKED_IN").length;
  const mealsTotal = tickets.filter((t) => t.mealOptionId).length;
  const mealsServed = tickets.filter((t) => t.foodCollectedAt).length;
  return { total, checkedIn, mealsTotal, mealsServed };
}
