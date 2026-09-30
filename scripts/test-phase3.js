/** Phase 3 billing verification: plan caps, badge, billing guards. */
// Pin the DB to the same file the app uses (next dev auto-loads .env; plain node does not).
process.env.DATABASE_URL = "file:/home/hatch/workspace/event-ticketing/prisma/dev.db";
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const BASE = "http://localhost:3100";
let pass = 0,
  fail = 0;
function ok(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`ok   ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name} ${extra}`);
  }
}
async function req(method, path, jar, body) {
  const headers = {};
  if (jar) headers.Cookie = jar;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  const setCookie = res.headers.get("set-cookie");
  return { res, data, setCookie };
}

(async () => {
  const db = new PrismaClient();
  const pw = await bcrypt.hash("password123", 10);
  const user = await db.user.create({
    data: {
      name: "Bill Tester",
      email: "bill@test.local",
      passwordHash: pw,
      emailVerified: true,
      memberships: {
        create: { organization: { create: { name: "Bill Org", slug: "bill-org" } }, role: "ORG_OWNER" },
      },
    },
    include: { memberships: true },
  });
  const orgId = user.memberships[0].organizationId;

  // Start server
  const { spawn } = require("child_process");
  const srv = spawn("npx", ["next", "dev", "-p", "3100"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: "file:/home/hatch/workspace/event-ticketing/prisma/dev.db",
      SESSION_SECRET: "testsecret",
      APP_URL: "http://localhost:3100",
      PLATFORM_ADMIN_EMAILS: "platform@test.local",
    },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 14000));

  try {
    // Login
    let r = await req("POST", "/api/auth/login", null, { email: "bill@test.local", password: "password123" });
    ok("login", r.res.status === 200, r.res.status);
    const jar = (r.setCookie || "").split(",").map((c) => c.split(";")[0]).join("; ");

    // Create two draft events
    const mkEvent = async (title) => {
      const e = await db.event.create({
        data: {
          title,
          slug: "evt-" + Math.random().toString(36).slice(2, 8),
          date: new Date(Date.now() + 86400000),
          status: "DRAFT",
          organizationId: orgId,
          createdById: user.id,
        },
      });
      return e.id;
    };
    const e1 = await mkEvent("Event One");
    const e2 = await mkEvent("Event Two");

    // 1. Publish first event on FREE -> ok
    r = await req("PATCH", `/api/admin/events/${e1}`, jar, { status: "PUBLISHED" });
    ok("free: publish 1st event", r.res.status === 200, r.res.status);

    // 2. Publish second event on FREE -> 402 upgradeRequired
    r = await req("PATCH", `/api/admin/events/${e2}`, jar, { status: "PUBLISHED" });
    ok("free: publish 2nd event blocked 402", r.res.status === 402 && r.data?.upgradeRequired === true, `${r.res.status} ${JSON.stringify(r.data)}`);

    // 3. Add team seats: 2nd ok, 3rd blocked
    r = await req("POST", "/api/admin/users", jar, { name: "T2", email: "t2@test.local", password: "password123", role: "ORG_STAFF" });
    ok("free: 2nd seat ok", r.res.status === 201, r.res.status);
    r = await req("POST", "/api/admin/users", jar, { name: "T3", email: "t3@test.local", password: "password123", role: "ORG_STAFF" });
    ok("free: 3rd seat blocked 402", r.res.status === 402 && r.data?.upgradeRequired === true, `${r.res.status} ${JSON.stringify(r.data)}`);

    // 4. Ticket cap: create ticket type with 600 capacity, order 501 tickets -> blocked
    const tt = await db.ticketType.create({ data: { eventId: e1, name: "GA", priceCents: 1000, quantityTotal: 600, sortOrder: 0 } });
    const items501 = [{ ticketTypeId: tt.id, qty: 501 }];
    r = await req("POST", "/api/orders", null, {
      eventId: e1, buyerName: "Buyer B", buyerEmail: "b@x.com", payMethod: "CASH", items: items501,
    });
    ok("free: 501-ticket order blocked", !r.res.ok && /500-ticket limit/.test(r.data?.error || ""), `${r.res.status} ${JSON.stringify(r.data)}`);

    // 5. 500 tickets ok on FREE
    const items500 = [{ ticketTypeId: tt.id, qty: 500 }];
    r = await req("POST", "/api/orders", null, {
      eventId: e1, buyerName: "Buyer C", buyerEmail: "c@x.com", payMethod: "CASH", items: items500,
    });
    ok("free: 500-ticket order ok", r.res.status === 200 || r.res.status === 201, `${r.res.status} ${JSON.stringify(r.data)}`);

    // 6. Billing status shows FREE + usage
    r = await req("GET", "/api/billing/status", jar);
    ok("billing status FREE", r.data?.plan === "FREE" && r.data?.usage?.activeEvents === 1, JSON.stringify(r.data)?.slice(0, 120));

    // 7. Public event shows badge on FREE
    const slug = (await db.event.findUnique({ where: { id: e1 }, select: { slug: true } })).slug;
    r = await req("GET", `/api/events/${slug}`, null);
    ok("free: showBadge true", r.data?.showBadge === true, JSON.stringify(r.data)?.slice(0, 80));

    // 8. Stripe unconfigured -> checkout 503, portal 404/503
    r = await req("POST", "/api/billing/checkout", jar);
    ok("checkout 503 without stripe", r.res.status === 503, r.res.status);
    r = await req("POST", "/api/billing/portal", jar);
    ok("portal 404 without billing account", r.res.status === 404, r.res.status);

    // 9. Webhook rejects missing/bad signature
    r = await req("POST", "/api/billing/webhook", null, { fake: 1 });
    ok("webhook 503 without secret configured", r.res.status === 503, r.res.status);

    // 10. Flip to PRO -> caps lifted
    await db.organization.update({ where: { id: orgId }, data: { plan: "PRO", subscriptionStatus: "ACTIVE" } });
    r = await req("PATCH", `/api/admin/events/${e2}`, jar, { status: "PUBLISHED" });
    ok("pro: publish 2nd event ok", r.res.status === 200, r.res.status);
    r = await req("POST", "/api/admin/users", jar, { name: "T3", email: "t3@test.local", password: "password123", role: "ORG_STAFF" });
    ok("pro: 3rd seat ok", r.res.status === 201, `${r.res.status} ${JSON.stringify(r.data)}`);
    // more tickets on pro (need new type with capacity)
    const tt2 = await db.ticketType.create({ data: { eventId: e2, name: "GA2", priceCents: 1000, quantityTotal: 500, sortOrder: 0 } });
    r = await req("POST", "/api/orders", null, {
      eventId: e2, buyerName: "Buyer D", buyerEmail: "d@x.com", payMethod: "CASH",
      items: [{ ticketTypeId: tt2.id, qty: 150 }],
    });
    ok("pro: 150-ticket order ok", r.res.status === 200 || r.res.status === 201, `${r.res.status} ${JSON.stringify(r.data)?.slice(0, 120)}`);

    // 11. Badge hidden on PRO
    r = await req("GET", `/api/events/${slug}`, null);
    ok("pro: showBadge false", r.data?.showBadge === false, JSON.stringify(r.data)?.slice(0, 80));

    // 12. Pricing page public
    r = await req("GET", "/pricing", null);
    ok("pricing page 200", r.res.status === 200, r.res.status);

    // 13. Non-admin cannot start checkout (door role)
    const door = await db.user.create({
      data: { name: "Door", email: "door@test.local", passwordHash: pw, emailVerified: true,
        memberships: { create: { organizationId: orgId, role: "ORG_DOOR" } } },
    });
    let r2 = await req("POST", "/api/auth/login", null, { email: "door@test.local", password: "password123" });
    const jar2 = (r2.setCookie || "").split(",").map((c) => c.split(";")[0]).join("; ");
    r2 = await req("POST", "/api/billing/checkout", jar2);
    ok("door role blocked from checkout", r2.res.status === 403, r2.res.status);

    // 14. Platform admin: org owner (not a platform admin) gets 403
    r = await req("GET", "/api/platform/orgs", jar);
    ok("non-platform-admin blocked from platform api", r.res.status === 403, r.res.status);

    // Platform admin user (listed in PLATFORM_ADMIN_EMAILS for this server)
    const pa = await db.user.create({
      data: { name: "Platform", email: "platform@test.local", passwordHash: pw, emailVerified: true,
        memberships: { create: { organizationId: orgId, role: "ORG_OWNER" } } },
    });
    let r3 = await req("POST", "/api/auth/login", null, { email: "platform@test.local", password: "password123" });
    const jar3 = (r3.setCookie || "").split(",").map((c) => c.split(";")[0]).join("; ");
    r3 = await req("GET", "/api/platform/orgs", jar3);
    ok("platform admin lists orgs", r3.res.status === 200 && r3.data?.organizations?.length >= 1, r3.res.status);

    // 15. Platform admin grants PRO via API
    r3 = await req("PATCH", `/api/platform/orgs/${orgId}`, jar3, { plan: "PRO" });
    ok("platform admin sets plan PRO", r3.res.status === 200 && r3.data?.organization?.plan === "PRO", `${r3.res.status} ${JSON.stringify(r3.data)}`);

    // 16. Platform admin sets a ticket override; enforcement respects it
    await db.organization.update({ where: { id: orgId }, data: { plan: "FREE" } });
    r3 = await req("PATCH", `/api/platform/orgs/${orgId}`, jar3, { maxTicketsOverride: 10 });
    ok("platform admin sets ticket override", r3.res.status === 200 && r3.data?.organization?.maxTicketsOverride === 10, `${r3.res.status} ${JSON.stringify(r3.data)}`);
    const e3 = await mkEvent("Event Three");
    await db.event.update({ where: { id: e3 }, data: { status: "PUBLISHED" } });
    const tt3 = await db.ticketType.create({ data: { eventId: e3, name: "GA3", priceCents: 1000, quantityTotal: 50, sortOrder: 0 } });
    r = await req("POST", "/api/orders", null, {
      eventId: e3, buyerName: "Buyer E", buyerEmail: "e@x.com", payMethod: "CASH",
      items: [{ ticketTypeId: tt3.id, qty: 11 }],
    });
    ok("override enforced: 11 blocked at limit 10", !r.res.ok && /10-ticket limit/.test(r.data?.error || ""), `${r.res.status} ${JSON.stringify(r.data)}`);
    r3 = await req("GET", "/api/billing/status", jar);
    ok("billing status shows override", r3.data?.limits?.maxTicketsPerEvent === 10, JSON.stringify(r3.data?.limits));

    // 17. Invalid override rejected
    r3 = await req("PATCH", `/api/platform/orgs/${orgId}`, jar3, { plan: "ENTERPRISE" });
    ok("invalid plan rejected", r3.res.status === 400, r3.res.status);

    console.log(`\n${pass} passed, ${fail} failed`);
  } finally {
    srv.kill();
    await db.$disconnect();
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
