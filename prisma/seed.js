/**
 * First-run admin setup. Runs on every container start (see
 * docker/entrypoint.sh) but only acts on a brand-new database with no users.
 *
 * Configure the admin login with:
 *   ADMIN_EMAIL     e.g. you@example.com
 *   ADMIN_PASSWORD  a strong password (min 8 characters)
 *
 * If neither is set, a random password is generated for
 * admin@eventpass.local and printed to the container logs ONCE —
 * save it, sign in, and change it immediately (top bar → Password).
 */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

function randomPassword() {
  return crypto.randomBytes(12).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 16) + "1a";
}

async function main() {
  const userCount = await db.user.count();
  if (userCount > 0) return; // database already initialized

  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if ((email && !password) || (!email && password)) {
    console.error("ERROR: set both ADMIN_EMAIL and ADMIN_PASSWORD, or neither.");
    process.exit(1);
  }
  if (password && password.length < 8) {
    console.error("ERROR: ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const finalEmail = email || "admin@eventpass.local";
  const finalPassword = password || randomPassword();
  const generated = !password;

  const passwordHash = await bcrypt.hash(finalPassword, 10);
  await db.user.create({
    data: { name: "Administrator", email: finalEmail, passwordHash, role: "ADMIN" },
  });

  console.log("=".repeat(64));
  console.log("  FIRST-RUN ADMIN ACCOUNT CREATED");
  console.log(`  Email:    ${finalEmail}`);
  if (generated) {
    console.log(`  Password: ${finalPassword}`);
    console.log("  This password is shown ONCE. Sign in and change it now");
    console.log("  (top bar → Password).");
  } else {
    console.log("  Password: (the ADMIN_PASSWORD you configured)");
    console.log("  Tip: remove ADMIN_PASSWORD from .env now that it is stored");
    console.log("  as a hash — change the password later via top bar → Password.");
  }
  console.log("=".repeat(64));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
