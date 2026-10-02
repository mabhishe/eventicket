/**
 * Resend-verification test.
 *
 * Boots the built app against a scratch DB and asserts over HTTP:
 *  - unauthenticated POST -> 401
 *  - authenticated but already-verified user -> 200 ok (no-op)
 *  - unverified user with email unconfigured -> 502 with an explicit error
 *    (fails loud, never silently "sent")
 *  - a verification token row is created for the unverified user
 *  - rate limit: 5/hour/IP -> 6th request is 429
 *
 * Note: email is unconfigured in test, so the send path returns the explicit
 * 502. The success path (real Resend send) is exercised in production.
 *
 * Usage: node scripts/test-resend-verification.js
 */
const { spawn, execSync } = require("child_process");
const path = require("path");

const PORT = 3107;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "/tmp/eventpass-resend-test.db";
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

  const mkUser = async (email, verified) => {
    const org = await db.organization.create({
      data: { name: `Org ${email}`, slug: email.replace(/[^a-z]/g, "") },
    });
    const user = await db.user.create({
      data: { name: "Test", email, passwordHash: hash, role: "SELLER", emailVerified: verified },
    });
    await db.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "ORG_OWNER" },
    });
    return user;
  };
  const unverified = await mkUser("unver@test.local", false);
  await mkUser("verified@test.local", true);
  await db.$disconnect();

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `file:${TEST_DB}`,
      SESSION_SECRET: "test-secret-resend",
      APP_URL: BASE,
      // NOTE: RESEND_API_KEY / EMAIL_FROM deliberately unset.
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server start timeout")), 30000);
    const onData = (d) => {
      const s = d.toString();
      if (s.includes("Ready in") || s.includes("started server")) {
        clearTimeout(t);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.on("exit", (c) => reject(new Error(`server exited ${c}`)));
  });
  await new Promise((r) => setTimeout(r, 1500));

  const jar = {};
  async function req(method, p, body, cookie) {
    const res = await fetch(`${BASE}${p}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) jar.c = setCookie.split(";")[0];
    let json = {};
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  }
  async function login(email) {
    const r = await req("POST", "/api/auth/login", { email, password: "password123" });
    check(`login ${email}`, r.status === 200, `got ${r.status}`);
    return jar.c;
  }

  try {
    // 1. Unauthenticated -> 401
    {
      const r = await req("POST", "/api/auth/resend-verification");
      check("unauthenticated -> 401", r.status === 401, `got ${r.status}`);
    }

    // 2. Already-verified user -> 200 ok (no-op, no token created)
    {
      const cookie = await login("verified@test.local");
      const r = await req("POST", "/api/auth/resend-verification", null, cookie);
      check("verified user -> 200 ok", r.status === 200 && r.json.ok === true, `got ${r.status}`);
    }

    // 3. Unverified user, email unconfigured -> explicit 502 (not silent)
    {
      const cookie = await login("unver@test.local");
      const r = await req("POST", "/api/auth/resend-verification", null, cookie);
      check(
        "unverified + no email config -> 502 explicit error",
        r.status === 502 && /config|failed/i.test(r.json.error || ""),
        `got ${r.status} ${JSON.stringify(r.json)}`
      );

      // 4. A fresh token row exists for the user
      const db2 = new PrismaClient({ datasources: { db: { url: `file:${TEST_DB}` } } });
      const tokens = await db2.verificationToken.findMany({
        where: { userId: unverified.id, type: "VERIFY_EMAIL", usedAt: null },
      });
      await db2.$disconnect();
      check("verification token created", tokens.length >= 1, `found ${tokens.length}`);
    }

    // 5. Rate limit: 5/hour/IP (2 used above as unverified? no — only 1 POST as unverified + 1 as verified = 2 used)
    {
      const cookie = await login("unver@test.local");
      let last = 0;
      for (let i = 0; i < 4; i++) {
        const r = await req("POST", "/api/auth/resend-verification", null, cookie);
        last = r.status;
      }
      // 2 prior + 4 = 6 total -> the 6th should be 429
      check("rate limit 429 on 6th request", last === 429, `got ${last}`);
    }
  } finally {
    server.kill();
  }

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test crashed:", e);
  process.exit(1);
});
