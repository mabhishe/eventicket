/**
 * Finance CSV + door sheet test.
 *
 * Seeds a scratch DB (org, owner, door user, published event, confirmed order
 * with tickets + meals), boots the built app, and asserts via HTTP:
 *  - finance CSV 200 with money columns and the order's total
 *  - guest-list CSV 200 with the new money columns
 *  - door sheet page 200 for a door-role user, org-scoped (other org -> 404)
 *  - finance CSV requires manager role (door -> 403)
 *
 * Usage: node scripts/test-finance-sheet.js
 */
const { spawn, execSync } = require("child_process");
const path = require("path");

const PORT = 3104;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "/tmp/eventpass-finance-test.db";
const ROOT = path.resolve(__dirname, "..");

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

async function main() {
  execSync(`rm -f ${TEST_DB} ${TEST_DB}-journal`);
  execSync("npx prisma migrate deploy", {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: "pipe",
  });
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: `file:${TEST_DB}` } } });
  const bcrypt = require("bcryptjs");
  const hash = await bcrypt.hash("password123", 10);
  const org = await db.organization.create({ data: { name: "Fin Org", slug: "fin-org" } });
  const orgB = await db.organization.create({ data: { name: "Other Org", slug: "other-org" } });
  const mk = (name, email) =>
    db.user.create({ data: { name, email, passwordHash: hash, role: "SELLER" } });
  const owner = await mk("Owner", "fin@test.local");
  const door = await mk("Door", "findoor@test.local");
  await db.membership.createMany({
    data: [
      { userId: owner.id, organizationId: org.id, role: "ORG_OWNER" },
      { userId: door.id, organizationId: org.id, role: "ORG_DOOR" },
    ],
  });
  const event = await db.event.create({
    data: {
      title: "Feast", slug: "feast-fin", date: new Date(Date.now() + 86400000),
      status: "PUBLISHED", organizationId: org.id, createdById: owner.id, currency: "CAD",
    },
  });
  const eventB = await db.event.create({
    data: {
      title: "Other", slug: "other-fin", date: new Date(Date.now() + 86400000),
      status: "PUBLISHED", organizationId: orgB.id, createdById: owner.id,
    },
  });
  const tt = await db.ticketType.create({
    data: { eventId: event.id, name: "Adult", priceCents: 3000, quantityTotal: 10, includesMeal: true },
  });
  const veg = await db.mealOption.create({ data: { eventId: event.id, name: "Veg", tag: "veg" } });
  const order = await db.order.create({
    data: {
      eventId: event.id, buyerName: "Buyer One", buyerEmail: "b1@test.local",
      buyerPhone: "4165550001", status: "CONFIRMED", payMethod: "ETRANSFER",
      totalCents: 6000, refCode: "ABCDEF",
      items: { create: [{ ticketTypeId: tt.id, qty: 2, unitPriceCents: 3000, mealOptionId: veg.id }] },
    },
  });
  await db.ticket.createMany({
    data: [
      { code: "T1", orderId: order.id, ticketTypeId: tt.id, mealOptionId: veg.id, status: "ISSUED" },
      { code: "T2", orderId: order.id, ticketTypeId: tt.id, mealOptionId: veg.id, status: "ISSUED" },
    ],
  });
  await db.$disconnect();

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}`, SESSION_SECRET: "test", APP_URL: BASE },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("start timeout")), 45000);
    const onData = (d) => {
      if (/Ready in|started server/.test(d.toString())) { clearTimeout(t); resolve(); }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
  });

  try {
    const login = async (email) => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });
      return (res.headers.get("set-cookie") || "").split(";")[0];
    };
    const ownerC = await login("fin@test.local");
    const doorC = await login("findoor@test.local");
    const get = (cookie, url) =>
      fetch(`${BASE}${url}`, { headers: cookie ? { Cookie: cookie } : {} });

    let r = await get(ownerC, `/api/admin/reports/finance?eventId=${event.id}`);
    const finCsv = await r.text();
    check("finance CSV 200", r.status === 200);
    check("finance has money headers", finCsv.includes("Total") && finCsv.includes("Pay method") && finCsv.includes("Order ref"));
    check("finance has order total", finCsv.includes("$60.00"));
    check("finance has buyer + method", finCsv.includes("Buyer One") && finCsv.includes("ETRANSFER"));

    r = await get(ownerC, `/api/admin/reports/guest-list?eventId=${event.id}`);
    const guestCsv = await r.text();
    check("guest CSV 200", r.status === 200);
    check("guest CSV money columns", guestCsv.includes("Order total") && guestCsv.includes("Pay method") && guestCsv.includes("Order ref"));

    r = await get(doorC, `/api/admin/reports/finance?eventId=${event.id}`);
    check("finance door role -> 403", r.status === 403);

    r = await get(ownerC, `/api/admin/reports/finance?eventId=${eventB.id}`);
    check("finance cross-org -> 404", r.status === 404);

    r = await get(doorC, `/door/${event.id}/sheet`);
    const sheetHtml = await r.text();
    check("door sheet 200 for door role", r.status === 200);
    check("sheet has buyer + entry code", sheetHtml.includes("Buyer One") && sheetHtml.includes("ABCDEF"));
    check("sheet has print CSS", sheetHtml.includes("@media print"));

    r = await get(doorC, `/door/${eventB.id}/sheet`);
    check("sheet cross-org -> not found", r.status === 404 || (await r.text()).includes("not found"));
  } finally {
    server.kill();
  }
  console.log(failures === 0 ? "All finance/sheet assertions passed." : `${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("crashed:", e); process.exit(1); });
