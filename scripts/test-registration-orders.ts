/** DB assertions: createOrder enforces the registration module rules. */
process.env.DATABASE_URL = "file:/home/hatch/workspace/event-ticketing/prisma/dev.db";
import assert from "node:assert";
import { PrismaClient } from "@prisma/client";
import { createOrder } from "../lib/orders";
import { serializeRegistrationFields, CAMP_PRESET } from "../lib/registrationFields";

const db = new PrismaClient();
let n = 0;
function ok(cond: unknown, label: string) {
  n++;
  assert(cond, label);
  console.log(`ok ${n} - ${label}`);
}

async function expectThrow(fn: () => Promise<unknown>, needle: string, label: string) {
  n++;
  try {
    await fn();
  } catch (e) {
    assert(String((e as Error).message).includes(needle), `${label} (got: ${(e as Error).message})`);
    console.log(`ok ${n} - ${label}`);
    return;
  }
  assert(false, `${label}: expected throw containing "${needle}"`);
}

async function main() {
  const email = `regtest-${Date.now()}@example.com`;
  const user = await db.user.create({
    data: { email, name: "Reg Test", passwordHash: "x" },
  });
  const org = await db.organization.create({
    data: { name: "Reg Test Org", slug: `regtest-${Date.now()}`, plan: "FREE" },
  });
  await db.membership.create({
    data: { userId: user.id, organizationId: org.id, role: "ORG_OWNER" },
  });
  const event = await db.event.create({
    data: {
      slug: `regtest-${Date.now()}`,
      title: "Reg Test Camp",
      date: new Date(Date.now() + 86400000),
      status: "PUBLISHED",
      organizationId: org.id,
      createdById: user.id,
      etransferEmail: "pay@example.com",
      registrationFields: serializeRegistrationFields({
        ...CAMP_PRESET,
        waiverText: "I accept the risks of camp.",
      }),
      ticketTypes: { create: [{ name: "Camper", priceCents: 10000, quantityTotal: 10, sortOrder: 0 }] },
    },
    include: { ticketTypes: true },
  });
  const typeId = event.ticketTypes[0].id;

  const base = {
    eventId: event.id,
    buyerName: "Test Parent",
    buyerEmail: "parent@example.com",
    payMethod: "ETRANSFER" as const,
    items: [{ ticketTypeId: typeId, qty: 1, holderName: "Test Kid" }],
  };

  // Missing everything → emergency contact error first.
  await expectThrow(() => createOrder({ ...base }), "Emergency contact", "missing emergency contact rejected");
  // Emergency given, medical missing.
  await expectThrow(
    () => createOrder({ ...base, emergencyName: "Mom", emergencyPhone: "416-555-0100" }),
    "Medical / allergy notes",
    "missing medical notes rejected"
  );
  // Medical given, pickup missing.
  await expectThrow(
    () =>
      createOrder({
        ...base,
        emergencyName: "Mom",
        emergencyPhone: "416-555-0100",
        items: [{ ticketTypeId: typeId, qty: 1, holderName: "Test Kid", medicalNotes: "Peanut allergy" }],
      }),
    "pickup",
    "missing pickup rejected"
  );
  // Pickup given, waiver missing.
  await expectThrow(
    () =>
      createOrder({
        ...base,
        emergencyName: "Mom",
        emergencyPhone: "416-555-0100",
        pickupAuth: "Dad, Grandma",
        items: [{ ticketTypeId: typeId, qty: 1, holderName: "Test Kid", medicalNotes: "Peanut allergy" }],
      }),
    "waiver",
    "missing waiver acceptance rejected"
  );
  // Waiver checked but no typed name.
  await expectThrow(
    () =>
      createOrder({
        ...base,
        emergencyName: "Mom",
        emergencyPhone: "416-555-0100",
        pickupAuth: "Dad, Grandma",
        waiverAccepted: true,
        items: [{ ticketTypeId: typeId, qty: 1, holderName: "Test Kid", medicalNotes: "Peanut allergy" }],
      }),
    "waiver",
    "waiver without typed name rejected"
  );

  // Complete order succeeds and stores everything.
  const order = await createOrder({
    ...base,
    emergencyName: "Mom",
    emergencyPhone: "416-555-0100",
    emergencyRelation: "Mother",
    pickupAuth: "Dad, Grandma",
    waiverAccepted: true,
    waiverSignedName: "Test Parent",
    items: [{ ticketTypeId: typeId, qty: 1, holderName: "Test Kid", medicalNotes: "Peanut allergy" }],
  });
  ok(order.emergencyName === "Mom", "emergency name stored");
  ok(order.emergencyPhone === "416-555-0100", "emergency phone stored");
  ok(order.emergencyRelation === "Mother", "emergency relation stored");
  ok(order.pickupAuth === "Dad, Grandma", "pickup stored");
  ok(order.waiverAcceptedAt instanceof Date, "waiver timestamp stored");
  ok(order.waiverSignedName === "Test Parent", "waiver signature stored");
  ok(order.waiverTextSnapshot === "I accept the risks of camp.", "waiver text snapshot stored");
  const item = await db.orderItem.findFirst({ where: { orderId: order.id } });
  ok(item?.medicalNotes === "Peanut allergy", "medical notes stored on item");

  // Medical notes propagate to issued tickets (door sheet reads tickets).
  const { issueTickets } = await import("../lib/orders");
  const tickets = await issueTickets(order.id, { allowPending: true });
  ok(tickets[0].medicalNotes === "Peanut allergy", "medical notes copied to ticket");

  // Event with modules off: no registration data required or stored.
  const event2 = await db.event.create({
    data: {
      slug: `regtest2-${Date.now()}`,
      title: "Reg Test Plain",
      date: new Date(Date.now() + 86400000),
      status: "PUBLISHED",
      organizationId: org.id,
      createdById: user.id,
      etransferEmail: "pay@example.com",
      ticketTypes: { create: [{ name: "General", priceCents: 1000, quantityTotal: 10, sortOrder: 0 }] },
    },
    include: { ticketTypes: true },
  });
  const plain = await createOrder({
    eventId: event2.id,
    buyerName: "Plain Buyer",
    buyerEmail: "plain@example.com",
    payMethod: "ETRANSFER",
    items: [{ ticketTypeId: event2.ticketTypes[0].id, qty: 1 }],
  });
  ok(plain.emergencyName === null, "modules off: nothing stored");

  // Cleanup.
  await db.order.deleteMany({ where: { eventId: { in: [event.id, event2.id] } } });
  await db.event.deleteMany({ where: { id: { in: [event.id, event2.id] } } });
  await db.membership.deleteMany({ where: { organizationId: org.id } });
  await db.organization.delete({ where: { id: org.id } });
  await db.user.delete({ where: { id: user.id } });
  console.log(`\nAll ${n} registration order assertions passed.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("FAIL:", e);
  db.$disconnect();
  process.exit(1);
});
