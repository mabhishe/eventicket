/**
 * Org isolation test (Phase 1 multi-tenant).
 *
 * Boots the built app against a scratch SQLite DB, creates two orgs with
 * users, and asserts via HTTP that org B can never see or touch org A's
 * events, orders, reports, door data — and vice versa.
 *
 * Usage: node scripts/test-org-isolation.js
 * Expects: `npm run build` has been run; starts `next start` on port 3101.
 */
const { spawn, execSync } = require("child_process");
const path = require("path");

const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "/tmp/eventpass-org-test.db";
const ROOT = path.resolve(__dirname, "..");

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

async function main() {
  // Fresh DB + migrations
  execSync(`rm -f ${TEST_DB} ${TEST_DB}-journal`);
  execSync("npx prisma migrate deploy", {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: "pipe",
  });

  // Seed two orgs + users via prisma client
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: `file:${TEST_DB}` } } });
  const bcrypt = require("bcryptjs");
  const hash = await bcrypt.hash("password123", 10);

  async function makeOrg(name, slug) {
    return db.organization.create({ data: { name, slug } });
  }
  async function makeUser(name, email) {
    return db.user.create({ data: { name, email, passwordHash: hash, role: "SELLER" } });
  }
  const orgA = await makeOrg("Org A", "org-a-test");
  const orgB = await makeOrg("Org B", "org-b-test");
  const ownerA = await makeUser("Owner A", "a@test.local");
  const ownerB = await makeUser("Owner B", "b@test.local");
  const doorB = await makeUser("Door B", "doorb@test.local");
  await db.membership.createMany({
    data: [
      { userId: ownerA.id, organizationId: orgA.id, role: "ORG_OWNER" },
      { userId: ownerB.id, organizationId: orgB.id, role: "ORG_OWNER" },
      { userId: doorB.id, organizationId: orgB.id, role: "ORG_DOOR" },
    ],
  });
  // An event + pending order in org A, created directly in the DB
  const eventA = await db.event.create({
    data: {
      title: "Org A Secret Gala",
      slug: "org-a-secret-gala-test",
      date: new Date("2026-12-01T19:00:00"),
      status: "PUBLISHED",
      organizationId: orgA.id,
      createdById: ownerA.id,
    },
  });
  const tt = await db.ticketType.create({
    data: { eventId: eventA.id, name: "General", priceCents: 1000, quantityTotal: 100 },
  });
  const orderA = await db.order.create({
    data: {
      eventId: eventA.id,
      buyerName: "Buyer A",
      status: "PENDING_PAYMENT",
      payMethod: "ETRANSFER",
      totalCents: 1000,
      items: { create: [{ ticketTypeId: tt.id, qty: 1, unitPriceCents: 1000 }] },
    },
  });
  await db.$disconnect();

  // Start the server
  const server = spawn(
    "npx",
    ["next", "start", "-p", String(PORT)],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: `file:${TEST_DB}`,
        SESSION_SECRET: "test-secret-for-org-isolation",
      },
      stdio: "pipe",
    }
  );
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server start timeout")), 30000);
    const onData = (d) => {
      if (d.toString().includes("Ready in") || d.toString().includes("started server")) {
        clearTimeout(t);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.on("exit", (c) => reject(new Error(`server exited ${c}`)));
  });
  // Give routes a moment
  await new Promise((r) => setTimeout(r, 1500));

  async function login(email) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    const cookie = (res.headers.get("set-cookie") || "")
      .split(",")
      .map((c) => c.split(";")[0].trim())
      .filter((c) => c.includes("="))
      .join("; ");
    return { ok: res.ok, cookie, body: await res.json() };
  }
  const authed = (cookie) => ({
    headers: { "Content-Type": "application/json", Cookie: cookie },
  });
  async function api(cookie, method, url, body) {
    const res = await fetch(`${BASE}${url}`, {
      method,
      ...authed(cookie),
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  }

  try {
    console.log("logins");
    const la = await login("a@test.local");
    const lb = await login("b@test.local");
    const ld = await login("doorb@test.local");
    check("owner A logs in", la.ok);
    check("owner B logs in", lb.ok);
    check("door B logs in", ld.ok);
    check("login returns org context", la.body.user?.orgId === orgA.id && la.body.user?.orgRole === "ORG_OWNER");

    console.log("event isolation");
    const listA = await api(la.cookie, "GET", "/api/admin/events");
    const listB = await api(lb.cookie, "GET", "/api/admin/events");
    check("A sees own event", listA.json.events.some((e) => e.id === eventA.id));
    check("B does NOT see A's event in list", !listB.json.events.some((e) => e.id === eventA.id));
    const getB = await api(lb.cookie, "GET", `/api/admin/events/${eventA.id}`);
    check("B gets 404 on A's event detail", getB.status === 404);
    const patchB = await api(lb.cookie, "PATCH", `/api/admin/events/${eventA.id}`, { title: "Hacked" });
    check("B cannot PATCH A's event", patchB.status === 404);

    console.log("order isolation");
    const ordersB = await api(lb.cookie, "GET", "/api/admin/orders");
    check("B does NOT see A's order", !ordersB.json.orders.some((o) => o.id === orderA.id));
    const confirmB = await api(lb.cookie, "POST", `/api/admin/orders/${orderA.id}/confirm`);
    check("B cannot confirm A's order", confirmB.status === 404);
    const confirmA = await api(la.cookie, "POST", `/api/admin/orders/${orderA.id}/confirm`);
    check("A can confirm own order", confirmA.status === 200);

    console.log("reports isolation");
    const repB = await api(lb.cookie, "GET", `/api/admin/reports?eventId=${eventA.id}`);
    check("B sees no revenue from A's event", repB.json.summary?.orders === 0 && repB.json.summary?.revenueCents === 0);

    console.log("door isolation");
    const doorEvtB = await api(ld.cookie, "GET", `/api/door/event/${eventA.id}`);
    check("B door staff gets 404 on A's event", doorEvtB.status === 404);
    const doorSearchB = await api(ld.cookie, "GET", `/api/door/search?eventId=${eventA.id}&q=Buyer`);
    check("B door search finds nothing in A's event", (doorSearchB.json.tickets || []).length === 0);

    console.log("sub-resource isolation");
    const ttB = await api(lb.cookie, "POST", `/api/admin/events/${eventA.id}/ticket-types`, { name: "X", priceCents: 1, quantityTotal: 1 });
    check("B cannot add ticket type to A's event", ttB.status === 404);

    console.log("organization settings isolation");
    const orgGetB = await api(lb.cookie, "GET", "/api/admin/organization");
    check("B reads only own org settings", orgGetB.json.organization?.id === orgB.id);
    const orgPatchB = await api(lb.cookie, "PATCH", "/api/admin/organization", { name: "Hacked" });
    check("B PATCH only affects own org", orgPatchB.json.organization?.id === orgB.id);
    const orgGetA = await api(la.cookie, "GET", "/api/admin/organization");
    check("A's org name untouched", orgGetA.json.organization?.name === "Org A");

    console.log("team invite");
    const invite = await api(la.cookie, "POST", "/api/admin/users", {
      name: "New Staff",
      email: "staff@test.local",
      password: "password123",
      role: "ORG_STAFF",
    });
    check("A owner invites staff", invite.status === 201);
    const teamA = await api(la.cookie, "GET", "/api/admin/users");
    check("team list shows invitee", teamA.json.users.some((u) => u.email === "staff@test.local"));
    const teamB = await api(lb.cookie, "GET", "/api/admin/users");
    check("B team list does NOT show A's staff", !teamB.json.users.some((u) => u.email === "staff@test.local"));
    const ls = await login("staff@test.local");
    const listS = await api(ls.cookie, "GET", "/api/admin/events");
    check("invited staff sees org A events", listS.json.events.some((e) => e.id === eventA.id));
  } finally {
    server.kill("SIGTERM");
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("TEST HARNESS ERROR:", e.message);
  process.exit(2);
});
