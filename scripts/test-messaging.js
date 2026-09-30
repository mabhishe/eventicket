/**
 * Messaging center test (Phase 4a).
 *
 * Part A: unit-tests lib/messaging.ts (compiled to /tmp with tsc) —
 *   variable interpolation, var-map building, template definitions.
 * Part B: boots the built app on a scratch DB and asserts via HTTP —
 *   template CRUD + validation, test-send, reminders CRUD + validation,
 *   broadcast, auth (401/403), cron secret (401/200), org isolation.
 *
 * Usage: node scripts/test-messaging.js
 * Expects: `npm run build` has been run; starts `next start` on port 3102.
 */
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "/tmp/eventpass-msg-test.db";
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

async function partA() {
  console.log("Part A: lib/messaging unit tests");
  const out = path.join(ROOT, ".tmp-msgtest-lib");
  execSync(`rm -rf ${out}`);
  execSync(
    `npx tsc lib/messaging.ts --outDir .tmp-msgtest-lib --module commonjs --target es2020 --esModuleInterop --skipLibCheck --moduleResolution node`,
    { cwd: ROOT, stdio: "pipe" }
  );
  let m;
  try {
    m = require(path.join(out, "messaging.js"));
  } finally {
    execSync(`rm -rf ${out}`);
  }

  check("renderVars replaces variables", m.renderVars("Hi {{buyer.name}}!", { "buyer.name": "Ava" }) === "Hi Ava!");
  check("renderVars tolerates spaces", m.renderVars("{{ buyer.name }}", { "buyer.name": "Ava" }) === "Ava");
  check("renderVars blanks unknown vars", m.renderVars("[{{nope}}]", {}) === "[]");
  check("renderVars leaves other text alone", m.renderVars("<p>x</p>", {}) === "<p>x</p>");
  check(
    "renderVars handles repeats",
    m.renderVars("{{a}}-{{a}}", { a: "1" }) === "1-1"
  );
  const vars = m.orderVars(
    { id: "o1", buyerName: "Ava Patel", refCode: "ABC123", entryCode: "999", totalCents: 2550 },
    { id: "e1", slug: "gala", title: "Gala Night", date: new Date("2026-12-01T19:00:00"), venue: "Hall", currency: "CAD" },
    "Test Org"
  );
  check("orderVars buyer.name", vars["buyer.name"] === "Ava Patel");
  check("orderVars refCode", vars["order.refCode"] === "ABC123");
  check("orderVars entryCode", vars["order.entryCode"] === "999");
  check("orderVars total formatted", vars["order.total"] === "$25.50");
  check("orderVars event.url", vars["event.url"].endsWith("/e/gala"));
  check("orderVars order.url", vars["order.url"].endsWith("/order/o1"));
  check("orderVars org.name", vars["org.name"] === "Test Org");
  check("TEMPLATE_DEFS has 5 keys", Object.keys(m.TEMPLATE_DEFS).length === 5);
  check(
    "every def lists valid channels",
    Object.values(m.TEMPLATE_DEFS).every((d) =>
      d.channels.every((c) => c === "EMAIL" || c === "WHATSAPP")
    )
  );
  check("TEMPLATE_VARS non-empty", m.TEMPLATE_VARS.length > 5);
}

async function partB() {
  console.log("Part B: HTTP assertions");
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
  const orgA = await db.organization.create({ data: { name: "Org A", slug: "org-a-msg" } });
  const orgB = await db.organization.create({ data: { name: "Org B", slug: "org-b-msg" } });
  const mkUser = (name, email) => db.user.create({ data: { name, email, passwordHash: hash, role: "SELLER" } });
  const ownerA = await mkUser("Owner A", "msga@test.local");
  const ownerB = await mkUser("Owner B", "msgb@test.local");
  const doorA = await mkUser("Door A", "msgdoor@test.local");
  await db.membership.createMany({
    data: [
      { userId: ownerA.id, organizationId: orgA.id, role: "ORG_OWNER" },
      { userId: ownerB.id, organizationId: orgB.id, role: "ORG_OWNER" },
      { userId: doorA.id, organizationId: orgA.id, role: "ORG_DOOR" },
    ],
  });
  const eventA = await db.event.create({
    data: {
      title: "Org A Gala",
      slug: "org-a-gala-msg",
      date: new Date(Date.now() + 7 * 86400000),
      status: "PUBLISHED",
      organizationId: orgA.id,
      createdById: ownerA.id,
    },
  });
  await db.$disconnect();

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `file:${TEST_DB}`,
      SESSION_SECRET: "test-session-secret",
      CRON_SECRET: "test-cron-secret",
      APP_URL: BASE,
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server start timeout")), 45000);
    const onData = (d) => {
      if (d.toString().includes("Ready in") || d.toString().includes("started server")) {
        clearTimeout(t);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
  });

  try {
    async function login(email) {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });
      const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
      return { ok: res.ok, cookie };
    }
    const api = (cookie, method, url, body) =>
      fetch(`${BASE}${url}`, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

    const la = await login("msga@test.local");
    const lb = await login("msgb@test.local");
    const ld = await login("msgdoor@test.local");
    check("owner A login", la.ok);
    check("owner B login", lb.ok);

    // --- templates ---
    let r = await api(null, "GET", "/api/admin/messages/templates");
    check("templates unauthenticated -> 401", r.status === 401);
    r = await api(ld.cookie, "GET", "/api/admin/messages/templates");
    check("templates door role -> 403", r.status === 403);
    r = await api(la.cookie, "GET", "/api/admin/messages/templates");
    check("templates list 200", r.status === 200);
    check("templates has 5 defs", r.body.templates?.length === 5);
    check("templates expose variables", Array.isArray(r.body.variables) && r.body.variables.length > 5);
    const orKey = r.body.templates.find((t) => t.key === "ORDER_RECEIVED");
    check(
      "ORDER_RECEIVED email starts as default",
      orKey.channels.find((c) => c.channel === "EMAIL").custom === false
    );

    r = await api(la.cookie, "PUT", "/api/admin/messages/templates", {
      key: "NOPE",
      channel: "EMAIL",
      body: "x",
    });
    check("template PUT bad key -> 400", r.status === 400);
    r = await api(la.cookie, "PUT", "/api/admin/messages/templates", {
      key: "ORDER_RECEIVED",
      channel: "WHATSAPP",
      body: "hello",
    });
    check("template PUT whatsapp w/o name -> 400", r.status === 400);
    r = await api(la.cookie, "PUT", "/api/admin/messages/templates", {
      key: "ORDER_RECEIVED",
      channel: "EMAIL",
      subject: "Custom {{event.title}}",
      body: "<p>Hi {{buyer.name}}</p>",
    });
    check("template PUT custom email -> 200", r.status === 200);
    r = await api(la.cookie, "GET", "/api/admin/messages/templates");
    const orEmail = r.body.templates
      .find((t) => t.key === "ORDER_RECEIVED")
      .channels.find((c) => c.channel === "EMAIL");
    check("custom template marked custom", orEmail.custom === true);
    check("custom subject stored", orEmail.subject === "Custom {{event.title}}");
    // org isolation: B must not see A's customization
    r = await api(lb.cookie, "GET", "/api/admin/messages/templates");
    const orEmailB = r.body.templates
      .find((t) => t.key === "ORDER_RECEIVED")
      .channels.find((c) => c.channel === "EMAIL");
    check("org B unaffected by org A template", orEmailB.custom === false);
    r = await api(la.cookie, "DELETE", "/api/admin/messages/templates?key=ORDER_RECEIVED&channel=EMAIL");
    check("template DELETE resets", r.status === 200 && r.body.reset === true);

    // --- test send (Resend unconfigured -> sent=false, but 200 + logged) ---
    r = await api(la.cookie, "POST", "/api/admin/messages/test", {
      key: "ORDER_RECEIVED",
      channel: "EMAIL",
    });
    check("test email 200", r.status === 200);
    check("test email to owner", r.body.to === "msga@test.local");

    // --- reminders ---
    r = await api(la.cookie, "POST", "/api/admin/messages/reminders", {
      eventId: "nope",
      offsetMinutes: 1440,
      channel: "EMAIL",
    });
    check("reminder bad event -> 404", r.status === 404);
    r = await api(la.cookie, "POST", "/api/admin/messages/reminders", {
      eventId: eventA.id,
      offsetMinutes: 10,
      channel: "EMAIL",
    });
    check("reminder offset <15 -> 400", r.status === 400);
    r = await api(la.cookie, "POST", "/api/admin/messages/reminders", {
      eventId: eventA.id,
      offsetMinutes: 1440,
      channel: "EMAIL",
    });
    check("reminder create -> 201", r.status === 201);
    const remId = r.body.reminder?.id;
    r = await api(la.cookie, "GET", "/api/admin/messages/reminders");
    check("reminder listed", r.body.reminders?.some((x) => x.id === remId));
    r = await api(lb.cookie, "DELETE", `/api/admin/messages/reminders/${remId}`);
    check("reminder delete cross-org -> 404", r.status === 404);
    r = await api(la.cookie, "DELETE", `/api/admin/messages/reminders/${remId}`);
    check("reminder delete own -> 200", r.status === 200);

    // --- broadcast ---
    r = await api(la.cookie, "POST", "/api/admin/messages/broadcast", {
      eventId: eventA.id,
      subject: "Hi",
      body: "<p>hello</p>",
    });
    check("broadcast no buyers -> 200 sent=0", r.status === 200 && r.body.sent === 0);
    r = await api(ld.cookie, "POST", "/api/admin/messages/broadcast", {
      eventId: eventA.id,
      subject: "Hi",
      body: "<p>hello</p>",
    });
    check("broadcast door role -> 403", r.status === 403);

    // --- cron ---
    r = await fetch(`${BASE}/api/cron/reminders`);
    check("cron no secret -> 401", r.status === 401);
    r = await fetch(`${BASE}/api/cron/reminders?secret=wrong`);
    check("cron wrong secret -> 401", r.status === 401);
    r = await fetch(`${BASE}/api/cron/reminders`, {
      headers: { Authorization: "Bearer test-cron-secret" },
    });
    const cronBody = await r.json();
    check("cron correct secret -> 200", r.status === 200 && cronBody.ok === true);
  } finally {
    server.kill();
  }
}

async function main() {
  await partA();
  await partB();
  console.log(failures === 0 ? "\nAll messaging assertions passed." : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test crashed:", e);
  process.exit(1);
});
