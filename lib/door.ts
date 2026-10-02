import { db } from "./db";
import { extractCode } from "./tickets";

/**
 * Shared resolution for door scans. A scan code can be:
 * - a per-person ticket code, which admits or serves that person, or
 * - an order refCode (family lookup). That code does not admit anyone;
 *   staff pick the person from the roster.
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
      emergencyAdmittedAt: true,
      event: { select: { title: true } },
    },
  },
} as const;

/** Confirmed orders and emergency admits can pass the door. A short payment cannot. */
export function orderAllowsEntry(order: {
  status: string;
  emergencyAdmittedAt?: Date | string | null;
}) {
  if (order.status === "CONFIRMED") return true;
  return order.status === "PENDING_PAYMENT" && order.emergencyAdmittedAt != null;
}

export function unpaidOrderMessage() {
  return "This order is not paid in full yet. It stays pending until the rest arrives. Use Search and Emergency admit only if you must let them in.";
}

export function familyCodeMessage(mode: "entry" | "food") {
  return mode === "entry"
    ? "Family code. Choose the person who is here. This code does not admit anyone by itself."
    : "Family code. Choose the person whose meal you are serving.";
}

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
      emergencyAdmittedAt: Date | null;
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
      emergencyAdmittedAt: true,
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
    emergencyAdmittedAt: order.emergencyAdmittedAt,
    nextTicket,
  };
}

/** Mark one issued ticket checked in. A second scanner loses the race. */
export async function claimEntry(ticketId: string): Promise<boolean> {
  const claimed = await db.ticket.updateMany({
    where: { id: ticketId, status: "ISSUED" },
    data: { status: "CHECKED_IN", checkedInAt: new Date() },
  });
  return claimed.count === 1;
}

/** Record food for one ticket. A second scanner loses the race. */
export async function claimFood(ticketId: string): Promise<boolean> {
  const claimed = await db.ticket.updateMany({
    where: {
      id: ticketId,
      foodCollectedAt: null,
      status: { not: "CANCELLED" },
    },
    data: { foodCollectedAt: new Date() },
  });
  return claimed.count === 1;
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

export type RosterTicket = {
  id: string;
  code: string;
  holderName: string | null;
  status: string;
  checkedInAt: string | null;
  foodCollectedAt: string | null;
  ticketType: { name: string };
  mealOption: { name: string; tag: string | null } | null;
};

/** Full per-person roster for an order, oldest ticket first. */
export async function partyRoster(orderId: string): Promise<RosterTicket[]> {
  const tickets = await db.ticket.findMany({
    where: { orderId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "asc" },
    include: {
      ticketType: { select: { name: true } },
      mealOption: { select: { name: true, tag: true } },
    },
  });
  return tickets.map((t) => ({
    id: t.id,
    code: t.code,
    holderName: t.holderName,
    status: t.status,
    checkedInAt: t.checkedInAt ? t.checkedInAt.toISOString() : null,
    foodCollectedAt: t.foodCollectedAt ? t.foodCollectedAt.toISOString() : null,
    ticketType: { name: t.ticketType.name },
    mealOption: t.mealOption
      ? { name: t.mealOption.name, tag: t.mealOption.tag }
      : null,
  }));
}
