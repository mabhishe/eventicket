/**
 * Signup security test (Phase 2).
 *
 * Boots the built app against a scratch DB and asserts over HTTP:
 *  - signup creates user + org + ORG_OWNER membership
 *  - unverified organizers CANNOT publish events (but can draft)
 *  - email verification token flips the flag; then publishing works
 *  - tokens are single-use and reject garbage
 *  - forgot-password never reveals whether an email is registered
 *  - reset token (1h, single-use) sets a new password; old token can't be reused
 *  - signup is rate-limited (5/hour/IP)
 *
 * Note: email is unconfigured in test, so signup auto-verifies; the
 * unverified path is exercised with a directly-created unverified user.
 *
 * Usage: node scripts/test-signup-security.js
 */
const { spawn, execSync } = require("child_process");
const path = require("path");
const crypto = require("crypto");

const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "/tmp/eventpass-signup-test.db";
const ROOT = path.resolve(__dirname, "..");

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

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

  // Unverified owner, created directly in the DB
  const orgU = await db.organization.create({ data: { name: "Unverified Org", slug: "unver-org" } });
  const userU = await db.user.create({
    data: { name: "Unverified", email: "unver@test.local", passwordHash: hash, role: "SELLER", emailVerified: false },
  });
  await db.membership.create({ data: { userId: userU.id, organizationId: orgU.id, role: "ORG_OWNER" } });
  await db.$disconnect();

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `file:${TEST_DB}`,
      SESSION_SECRET: "test-secret-signup",
      ALLOW_PUBLIC_SIGNUP: "true",
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server start timeout")), 30000);
    const onData = (d) => {
      const s = d.toString();
      if (s.includes("Ready in") || s.includes("started server")) { clearTimeout(t); resolve(); }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.on("exit", (c) => reject(new Error(`server exited ${c}`)));
  });
  await new Promise((r) => setTimeout(r, 1500));

  async function login(email, password = "password123") {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const cookie = (res.headers.get("set-cookie") || "").split(",").map((c) => c.split(";")[0].trim()).filter((c) => c.includes("=")).join("; ");
    return { ok: res.ok, cookie, body: await res.json().catch(() => ({})) };
  }
  async function api(cookie, method, url, body) {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }

  try {
    console.log("signup");
    const s = await api(null, "POST", "/api/auth/signup", {
      name: "New Org", orgName: "Brand New Org", email: "new@test.local", password: "password123",
    });
    check("signup 201", s.status === 201, `got ${s.status}`);
    check("signup returns owner context", s.json.user?.orgRole === "ORG_OWNER" && !!s.json.user?.orgId);
    const ls = await login("new@test.local");
    check("new user can log in", ls.ok);
    const dup = await api(null, "POST", "/api/auth/signup", {
      name: "Dup", orgName: "Dup Org", email: "new@test.local", password: "password123",
    });
    check("duplicate email rejected", dup.status === 400);
    const weak = await api(null, "POST", "/api/auth/signup", {
      name: "W", orgName: "W Org", email: "weak@test.local", password: "short",
    });
    check("short password rejected", weak.status === 400);

    console.log("publish gate");
    const lu = await login("unver@test.local");
    check("unverified user logs in", lu.ok);
    const ev = await api(lu.cookie, "POST", "/api/admin/events", {
      title: "Draft Event", date: new Date("2026-12-01T19:00:00").toISOString(),
    });
    check("unverified user can create DRAFT", ev.status === 201, `got ${ev.status}`);
    const pub = await api(lu.cookie, "PATCH", `/api/admin/events/${ev.json.event.id}`, { status: "PUBLISHED" });
    check("unverified user CANNOT publish (403)", pub.status === 403, `got ${pub.status}`);

    console.log("email verification");
    // Plant a verification token directly (email is unconfigured in test)
    const db2 = new PrismaClient({ datasources: { db: { url: `file:${TEST_DB}` } } });
    const rawVerify = crypto.randomBytes(32).toString("hex");
    await db2.verificationToken.create({
      data: { userId: userU.id, tokenHash: sha256(rawVerify), type: "VERIFY_EMAIL", expiresAt: new Date(Date.now() + 86400000) },
    });
    const badVerify = await api(null, "GET", `/api/auth/verify-email?token=garbage`);
    check("garbage token rejected", badVerify.status === 400);
    const goodVerify = await api(null, "GET", `/api/auth/verify-email?token=${rawVerify}`);
    check("valid token verifies", goodVerify.status === 200);
    const reuseVerify = await api(null, "GET", `/api/auth/verify-email?token=${rawVerify}`);
    check("token is single-use", reuseVerify.status === 400);
    const pub2 = await api(lu.cookie, "PATCH", `/api/admin/events/${ev.json.event.id}`, { status: "PUBLISHED" });
    check("verified user CAN publish", pub2.status === 200, `got ${pub2.status}`);
    await db2.$disconnect();

    console.log("password reset");
    const fgUnknown = await api(null, "POST", "/api/auth/forgot-password", { email: "nobody@test.local" });
    check("forgot-password ok for unknown email (no enumeration)", fgUnknown.status === 200 && fgUnknown.json.ok === true);
    const fgKnown = await api(null, "POST", "/api/auth/forgot-password", { email: "new@test.local" });
    check("forgot-password ok for known email", fgKnown.status === 200);
    const db3 = new PrismaClient({ datasources: { db: { url: `file:${TEST_DB}` } } });
    const newUser = await db3.user.findUnique({ where: { email: "new@test.local" } });
    const rawReset = crypto.randomBytes(32).toString("hex");
    await db3.verificationToken.create({
      data: { userId: newUser.id, tokenHash: sha256(rawReset), type: "RESET_PASSWORD", expiresAt: new Date(Date.now() + 3600000) },
    });
    await db3.$disconnect();
    const resetBad = await api(null, "POST", "/api/auth/reset-password", { token: "nope", password: "newpassword123" });
    check("reset with bad token rejected", resetBad.status === 400);
    const resetWeak = await api(null, "POST", "/api/auth/reset-password", { token: rawReset, password: "short" });
    check("reset with short password rejected", resetWeak.status === 400);
    const resetOk = await api(null, "POST", "/api/auth/reset-password", { token: rawReset, password: "newpassword123" });
    check("reset with valid token works", resetOk.status === 200);
    const resetReuse = await api(null, "POST", "/api/auth/reset-password", { token: rawReset, password: "another123" });
    check("reset token single-use", resetReuse.status === 400);
    const loginNew = await login("new@test.local", "newpassword123");
    check("login with new password works", loginNew.ok);
    const loginOld = await login("new@test.local", "password123");
    check("old password no longer works", !loginOld.ok);

    console.log("signup rate limit");
    let limited = false;
    for (let i = 0; i < 6; i++) {
      const r = await api(null, "POST", "/api/auth/signup", {
        name: `R${i}`, orgName: `R Org ${i}`, email: `rate${i}@test.local`, password: "password123",
      });
      if (r.status === 429) limited = true;
    }
    check("6th rapid signup is rate-limited (429)", limited);
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
