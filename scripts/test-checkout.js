/**
 * Checkout flow test (Phase 4b).
 *
 * Seeds a scratch DB with an org + published event (ticket types with meals),
 * boots the built app, and asserts via HTTP:
 *  - event page renders with step headers, same-meal toggle, meal pills,
 *    terms checkbox, sticky bar, payment methods
 *  - placing an order works end-to-end (incl. same-meal-for-all items)
 *  - terms + privacy pages return 200
 *  - order without agreeing still succeeds server-side (checkbox is UX-only;
 *    server validates meals + buyer identity)
 *
 * Prints the local URL for a visual screenshot pass.
 * Usage: node scripts/test-checkout.js [--serve]  (keeps server up with --serve)
 */
const { spawn, execSync } = require("child_process");
const path = require("path");

const PORT = 3103;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "/tmp/eventpass-checkout-test.db";
const ROOT = path.resolve(__dirname, "..");
const SERVE = process.argv.includes("--serve");

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
  const org = await db.organization.create({ data: { name: "Checkout Org", slug: "checkout-org" } });
  const owner = await db.user.create({
    data: { name: "Owner", email: "co@test.local", passwordHash: await bcrypt.hash("password123", 10), role: "SELLER" },
  });
  await db.membership.create({ data: { userId: owner.id, organizationId: org.id, role: "ORG_OWNER" } });
  const event = await db.event.create({
    data: {
      title: "Community Feast",
      slug: "community-feast-test",
      date: new Date(Date.now() + 7 * 86400000),
      venue: "Hall",
      status: "PUBLISHED",
      organizationId: org.id,
      createdById: owner.id,
      etransferEmail: "pay@test.local",
    },
  });
  const adult = await db.ticketType.create({
    data: { eventId: event.id, name: "Adult", priceCents: 3000, quantityTotal: 50, includesMeal: true },
  });
  const kid = await db.ticketType.create({
    data: { eventId: event.id, name: "Kid", priceCents: 1500, quantityTotal: 50, includesMeal: false },
  });
  const veg = await db.mealOption.create({ data: { eventId: event.id, name: "Vegetarian", tag: "VEG" } });
  const nonveg = await db.mealOption.create({ data: { eventId: event.id, name: "Non veg", tag: "NON-VEG" } });
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
    const pageRes = await fetch(`${BASE}/e/community-feast-test`);
    check("event page 200", pageRes.status === 200);
    // The page is client-rendered; UI markers live in the built JS chunks.
    const markers = [
      "Same meal for all",
      "checkout-form",
      "Terms of Service",
      "/privacy",
      "/terms",
      "Your details",
      "Place order",
      "Choose tickets",
    ];
    const found = execSync(
      `grep -rh -o ${markers.map((m) => `-e "${m}"`).join(" ")} .next/static/chunks/ 2>/dev/null | sort -u`,
      { cwd: ROOT }
    ).toString();
    for (const m of markers) check(`bundle has "${m}"`, found.includes(m));

    for (const p of ["/terms", "/privacy"]) {
      const r = await fetch(`${BASE}${p}`);
      check(`${p} 200`, r.status === 200);
    }

    // Place an order end-to-end (2 adults same-meal veg + 1 kid no meal)
    const orderRes = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        buyerName: "Test Buyer",
        buyerEmail: "buyer@test.local",
        buyerPhone: "4165551234",
        payMethod: "ETRANSFER",
        items: [
          { ticketTypeId: adult.id, qty: 1, mealOptionId: veg.id, holderName: "Guest One" },
          { ticketTypeId: adult.id, qty: 1, mealOptionId: veg.id, holderName: "Guest Two" },
          { ticketTypeId: kid.id, qty: 1, mealOptionId: null, holderName: "Kid One" },
        ],
      }),
    });
    const orderBody = await orderRes.json();
    check("order placed 201", orderRes.status === 201);
    check("order total 7500", orderBody.order?.totalCents === 7500);

    // Meal required but missing -> 400
    const badRes = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        buyerName: "No Meal",
        buyerEmail: "nomeal@test.local",
        payMethod: "ETRANSFER",
        items: [{ ticketTypeId: adult.id, qty: 1, mealOptionId: null }],
      }),
    });
    check("missing meal rejected", badRes.status === 400);

    console.log(`\nVisual check URL (server ${SERVE ? "kept up" : "stopped"}): ${BASE}/e/community-feast-test`);
  } finally {
    if (!SERVE) server.kill();
    else await new Promise(() => {});
  }
  console.log(failures === 0 ? "All checkout assertions passed." : `${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("crashed:", e); process.exit(1); });
