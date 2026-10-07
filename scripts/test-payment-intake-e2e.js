/**
 * DB smoke test for payment intake apply / review / idempotency.
 * Run: npx tsx scripts/test-payment-intake-e2e.js
 */
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import {
  generateWebhookSecret,
  processPaymentIntake,
  findOrgByWebhookSecret,
  orgHasPaymentAutoMatch,
} from "../lib/paymentIntake.ts";

const db = new PrismaClient();

async function main() {
  const slug = `intake-test-${Date.now().toString(36)}`;
  const { raw, hash } = generateWebhookSecret();

  const org = await db.organization.create({
    data: {
      name: "Intake Test Org",
      slug,
      plan: "FREE",
      paymentAutoMatchEnabled: true,
      paymentWebhookSecretHash: hash,
    },
  });
  assert.ok(orgHasPaymentAutoMatch(org));

  const user = await db.user.create({
    data: {
      name: "Intake Tester",
      email: `${slug}@test.local`,
      passwordHash: "x",
      role: "ADMIN",
      emailVerified: true,
    },
  });

  const found = await findOrgByWebhookSecret(raw);
  assert.ok(found && found.id === org.id);
  assert.strictEqual(await findOrgByWebhookSecret("wrong-secret-xxxxxxxx"), null);

  const event = await db.event.create({
    data: {
      organizationId: org.id,
      createdById: user.id,
      slug: `${slug}-evt`,
      title: "Test Event",
      date: new Date("2026-12-01T18:00:00Z"),
      venue: "Hall",
      status: "PUBLISHED",
      currency: "CAD",
      timezone: "America/Toronto",
      etransferEmail: "pay@test.local",
    },
  });
  const tt = await db.ticketType.create({
    data: {
      eventId: event.id,
      name: "Adult",
      priceCents: 2500,
      quantityTotal: 100,
      sortOrder: 0,
    },
  });

  const order = await db.order.create({
    data: {
      eventId: event.id,
      buyerName: "Jai Kishan",
      buyerEmail: "jaikishan.k@outlook.com",
      buyerPhone: "6476202443",
      status: "PENDING_PAYMENT",
      payMethod: "ETRANSFER",
      totalCents: 2500,
      refCode: "3UMS7U",
      items: {
        create: {
          ticketTypeId: tt.id,
          qty: 1,
          unitPriceCents: 2500,
          holderName: "Jai Kishan",
        },
      },
    },
  });

  // 1) CODE match (mixed case + junk) → APPLIED + confirmed
  const r1 = await processPaymentIntake({
    orgId: org.id,
    payload: { test: 1 },
    input: {
      externalId: "CA-TEST-REF-001",
      method: "ETRANSFER",
      amountCents: 2500,
      message: "hi 3ums7u thanks",
      senderEmail: "someone-else@example.com",
    },
  });
  assert.strictEqual(r1.status, "APPLIED");
  assert.strictEqual(r1.match.tier, "CODE");
  assert.strictEqual(r1.match.orderId, order.id);
  assert.strictEqual(r1.confirmed, true);

  const after = await db.order.findUnique({
    where: { id: order.id },
    include: { payments: true },
  });
  assert.strictEqual(after.status, "CONFIRMED");
  assert.strictEqual(after.payments.length, 1);
  assert.strictEqual(after.payments[0].amountCents, 2500);

  // 2) Idempotent replay
  const r2 = await processPaymentIntake({
    orgId: org.id,
    payload: { test: 2 },
    input: {
      externalId: "CA-TEST-REF-001",
      method: "ETRANSFER",
      amountCents: 2500,
      message: "3UMS7U",
    },
  });
  assert.strictEqual(r2.status, "ALREADY_PROCESSED");
  assert.strictEqual(r2.intakeId, r1.intakeId);

  // 3) No code / no email match → NEEDS_REVIEW
  const order2 = await db.order.create({
    data: {
      eventId: event.id,
      buyerName: "Other Buyer",
      buyerEmail: "other@example.com",
      status: "PENDING_PAYMENT",
      payMethod: "ETRANSFER",
      totalCents: 4000,
      refCode: "AB12CD",
      items: {
        create: {
          ticketTypeId: tt.id,
          qty: 1,
          unitPriceCents: 4000,
          holderName: "Other Buyer",
        },
      },
    },
  });
  const r3 = await processPaymentIntake({
    orgId: org.id,
    payload: { test: 3 },
    input: {
      externalId: "CA-TEST-REF-002",
      method: "ETRANSFER",
      amountCents: 4000,
      message: "forgot the code",
      senderName: "Mystery Person",
      senderEmail: "mystery@example.com",
    },
  });
  assert.strictEqual(r3.status, "NEEDS_REVIEW");
  assert.ok(r3.candidates.some((c) => c.orderId === order2.id));

  // 4) EMAIL_AMOUNT match
  const order3 = await db.order.create({
    data: {
      eventId: event.id,
      buyerName: "Email Match",
      buyerEmail: "email.match@example.com",
      status: "PENDING_PAYMENT",
      payMethod: "ETRANSFER",
      totalCents: 1500,
      refCode: "ZZ99YY",
      items: {
        create: {
          ticketTypeId: tt.id,
          qty: 1,
          unitPriceCents: 1500,
          holderName: "Email Match",
        },
      },
    },
  });
  const r4 = await processPaymentIntake({
    orgId: org.id,
    payload: { test: 4 },
    input: {
      externalId: "CA-TEST-REF-003",
      method: "ETRANSFER",
      amountCents: 1500,
      message: "",
      senderEmail: "Email.Match@example.com",
    },
  });
  assert.strictEqual(r4.status, "APPLIED");
  assert.strictEqual(r4.match.tier, "EMAIL_AMOUNT");
  assert.strictEqual(r4.match.orderId, order3.id);
  assert.strictEqual(r4.confirmed, true);

  // cleanup
  await db.organization.delete({ where: { id: org.id } });
  await db.user.delete({ where: { id: user.id } }).catch(() => {});
  console.log("payment-intake e2e OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
