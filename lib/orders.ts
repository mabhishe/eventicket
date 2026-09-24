import { Prisma } from "@prisma/client";
import { db } from "./db";
import { newTicketCode } from "./tickets";

/**
 * Ensure an order has a group-pass refCode, backfilling one for orders
 * created before refCodes existed. Idempotent; retries on collision.
 */
export async function ensureOrderRefCode(orderId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newTicketCode(6);
    try {
      // Atomic claim: only fills orders that still lack a code.
      const claimed = await db.order.updateMany({
        where: { id: orderId, refCode: null },
        data: { refCode: code },
      });
      if (claimed.count === 1) return code;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
    const existing = await db.order.findUnique({
      where: { id: orderId },
      select: { refCode: true },
    });
    if (existing?.refCode) return existing.refCode;
  }
  throw new Error("Could not assign a group code, please try again");
}

export type Availability = Record<
  string,
  { total: number; taken: number; left: number }
>;

/** Seats taken = sum of item qty across PENDING_PAYMENT + CONFIRMED orders. */
export async function ticketAvailability(
  eventId: string
): Promise<Availability> {
  const types = await db.ticketType.findMany({ where: { eventId } });
  const items = await db.orderItem.findMany({
    where: {
      order: { eventId, status: { in: ["PENDING_PAYMENT", "CONFIRMED"] } },
    },
    select: { ticketTypeId: true, qty: true },
  });
  const taken: Record<string, number> = {};
  for (const it of items) {
    taken[it.ticketTypeId] = (taken[it.ticketTypeId] ?? 0) + it.qty;
  }
  const out: Availability = {};
  for (const t of types) {
    const n = taken[t.id] ?? 0;
    out[t.id] = {
      total: t.quantityTotal,
      taken: n,
      left: Math.max(0, t.quantityTotal - n),
    };
  }
  return out;
}

async function uniqueTicketCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = newTicketCode();
    const exists = await tx.ticket.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique ticket code");
}

/**
 * Generate one Ticket per ordered seat. Idempotent: returns existing
 * tickets if the order was already issued.
 */
export async function issueTickets(orderId: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, tickets: true },
    });
    if (!order) throw new Error("Order not found");
    if (order.status !== "CONFIRMED") {
      throw new Error("Order is not confirmed");
    }
    if (order.tickets.length > 0) return order.tickets;

    const rows: Prisma.TicketCreateManyInput[] = [];
    for (const item of order.items) {
      for (let i = 0; i < item.qty; i++) {
        rows.push({
          code: await uniqueTicketCode(tx),
          orderId: order.id,
          ticketTypeId: item.ticketTypeId,
          mealOptionId: item.mealOptionId,
          holderName: item.holderName ?? order.buyerName,
        });
      }
    }
    await tx.ticket.createMany({ data: rows });
    return tx.ticket.findMany({
      where: { orderId: order.id },
      include: { ticketType: true, mealOption: true },
    });
  });
}

export type NewOrderItem = {
  ticketTypeId: string;
  qty: number;
  mealOptionId?: string | null;
  holderName?: string | null; // attendee name; per-person rows use qty: 1
};

export type NewOrderInput = {
  eventId: string;
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  payMethod: "ETRANSFER" | "ZELLE" | "CASH";
  notes?: string;
  sellerId?: string | null;
  status?: "PENDING_PAYMENT" | "CONFIRMED";
  items: NewOrderItem[];
};

/** Validate + create an order with its items. Throws on validation errors. */
export async function createOrder(input: NewOrderInput) {
  const event = await db.event.findUnique({
    where: { id: input.eventId },
    include: { ticketTypes: true, mealOptions: true },
  });
  if (!event) throw new Error("Event not found");
  if (input.status !== "CONFIRMED" && event.status !== "PUBLISHED") {
    throw new Error("Event is not published");
  }
  if (!input.buyerName.trim()) throw new Error("Buyer name is required");
  if (!input.items.length) throw new Error("No tickets selected");

  const avail = await ticketAvailability(input.eventId);
  const typeById = new Map(event.ticketTypes.map((t) => [t.id, t]));
  const mealById = new Map(event.mealOptions.map((m) => [m.id, m]));

  let totalCents = 0;
  const rows: Prisma.OrderItemCreateWithoutOrderInput[] = [];
  for (const item of input.items) {
    const type = typeById.get(item.ticketTypeId);
    if (!type) throw new Error("Unknown ticket type");
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new Error(`Invalid quantity for ${type.name}`);
    }
    const left = avail[item.ticketTypeId]?.left ?? 0;
    if (item.qty > left) {
      throw new Error(
        `Only ${left} × ${type.name} left (requested ${item.qty})`
      );
    }
    let mealOptionId: string | null = null;
    if (item.mealOptionId) {
      const meal = mealById.get(item.mealOptionId);
      if (!meal) throw new Error("Unknown meal option");
      if (!type.includesMeal) {
        throw new Error(`${type.name} does not include a meal choice`);
      }
      mealOptionId = meal.id;
    }
    if (
      type.includesMeal &&
      event.mealOptions.length > 0 &&
      !mealOptionId
    ) {
      throw new Error(`Please choose a meal for every ${type.name} guest`);
    }
    totalCents += type.priceCents * item.qty;
    rows.push({
      qty: item.qty,
      unitPriceCents: type.priceCents,
      holderName: item.holderName?.trim() || null,
      ticketType: { connect: { id: type.id } },
      ...(mealOptionId ? { mealOption: { connect: { id: mealOptionId } } } : {}),
    });
  }

  const data = {
    eventId: input.eventId,
    buyerName: input.buyerName.trim(),
    buyerEmail: input.buyerEmail?.trim() || null,
    buyerPhone: input.buyerPhone?.trim() || null,
    payMethod: input.payMethod,
    notes: input.notes?.trim() || null,
    sellerId: input.sellerId ?? null,
    status: input.status ?? "PENDING_PAYMENT",
    totalCents,
    items: { create: rows },
  };
  // Retry on the (extremely unlikely) refCode collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.order.create({
        data: { ...data, refCode: newTicketCode(6) },
        include: {
          items: { include: { ticketType: true, mealOption: true } },
        },
      });
    } catch (e) {
      if (
        attempt < 4 &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not create order, please try again");
}
