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

/**
 * Ensure an order has a public invite code, backfilling one for orders
 * created before invite codes existed. Idempotent; retries on collision.
 */
export async function ensureOrderInviteCode(orderId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newTicketCode(8);
    try {
      // Atomic claim: only fills orders that still lack a code.
      const claimed = await db.order.updateMany({
        where: { id: orderId, inviteCode: null },
        data: { inviteCode: code },
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
      select: { inviteCode: true },
    });
    if (existing?.inviteCode) return existing.inviteCode;
  }
  throw new Error("Could not assign an invite code, please try again");
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
  inviteCode?: string; // invite code from ?invite= — validated against same-event orders
  showOnWall?: boolean; // buyer opted into the public "who's going" wall
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
  if (!input.buyerEmail?.trim() && !input.buyerPhone?.trim()) {
    throw new Error("An email or phone number is required");
  }
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
    showOnWall: input.showOnWall ?? false,
    totalCents,
    items: { create: rows },
  };
  // Validate the invite code: it must belong to another order for the same
  // event. Invalid codes are ignored rather than rejected.
  let invitedBy: string | null = null;
  if (input.inviteCode?.trim()) {
    const referrer = await db.order.findUnique({
      where: { inviteCode: input.inviteCode.trim().toUpperCase() },
      select: { eventId: true, inviteCode: true },
    });
    if (referrer && referrer.eventId === input.eventId && referrer.inviteCode) {
      invitedBy = referrer.inviteCode;
    }
  }
  // Retry on the (extremely unlikely) refCode/inviteCode collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.order.create({
        data: {
          ...data,
          refCode: newTicketCode(6),
          inviteCode: newTicketCode(8),
          invitedBy,
        },
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

/** Cancel an order (buyer or staff path share the same logic). */
export async function cancelOrder(orderId: string) {
  return db.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: { orderId },
      data: { status: "CANCELLED" },
    });
    return tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });
  });
}

/**
 * Add tickets to a PENDING_PAYMENT order. Capacity-checked against current
 * availability (which already counts this order's existing items), total is
 * recomputed, and the same refCode/payment code is kept. No tickets are
 * issued — pending orders have none until payment is confirmed.
 */
export async function addOrderItems(
  orderId: string,
  items: NewOrderItem[]
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: { include: { ticketTypes: true, mealOptions: true } } },
  });
  if (!order) throw new Error("Order not found");
  if (order.status !== "PENDING_PAYMENT") {
    throw new Error("Only unpaid orders can be changed");
  }
  if (!items.length) throw new Error("No tickets selected");

  const event = order.event;
  const avail = await ticketAvailability(order.eventId);
  const typeById = new Map(event.ticketTypes.map((t) => [t.id, t]));
  const mealById = new Map(event.mealOptions.map((m) => [m.id, m]));

  let totalCents = order.totalCents;
  const rows: {
    qty: number;
    unitPriceCents: number;
    holderName: string | null;
    ticketTypeId: string;
    mealOptionId: string | null;
  }[] = [];
  for (const item of items) {
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
      ticketTypeId: type.id,
      mealOptionId,
    });
  }

  return db.$transaction(async (tx) => {
    for (const r of rows) {
      await tx.orderItem.create({
        data: {
          orderId,
          qty: r.qty,
          unitPriceCents: r.unitPriceCents,
          holderName: r.holderName,
          ticketTypeId: r.ticketTypeId,
          mealOptionId: r.mealOptionId,
        },
      });
    }
    return tx.order.update({
      where: { id: orderId },
      data: { totalCents },
      include: {
        items: { include: { ticketType: true, mealOption: true } },
      },
    });
  });
}

/**
 * Edit a PENDING_PAYMENT order's buyer details and per-item attendee names.
 * Enforces the same email-or-phone requirement as checkout.
 */
export async function updatePendingOrderDetails(
  orderId: string,
  input: {
    buyerName?: string;
    buyerEmail?: string;
    buyerPhone?: string;
    holderNames?: Record<string, string>;
  }
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      buyerName: true,
      buyerEmail: true,
      buyerPhone: true,
    },
  });
  if (!order) throw new Error("Order not found");
  if (order.status !== "PENDING_PAYMENT") {
    throw new Error("Only unpaid orders can be changed");
  }

  const buyerName = input.buyerName?.trim() || order.buyerName;
  const buyerEmail =
    input.buyerEmail === undefined
      ? order.buyerEmail
      : input.buyerEmail.trim() || null;
  const buyerPhone =
    input.buyerPhone === undefined
      ? order.buyerPhone
      : input.buyerPhone.trim() || null;
  if (!buyerName) throw new Error("Buyer name is required");
  if (!buyerEmail && !buyerPhone) {
    throw new Error("An email or phone number is required");
  }

  return db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { buyerName, buyerEmail, buyerPhone },
    });
    for (const [itemId, name] of Object.entries(input.holderNames || {})) {
      await tx.orderItem.updateMany({
        where: { id: itemId, orderId },
        data: { holderName: name.trim() || null },
      });
    }
    return tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { ticketType: true, mealOption: true } },
      },
    });
  });
}
