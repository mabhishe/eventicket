/**
 * Enable payment auto-match for an org (Canosa pilot) and print a fresh
 * webhook secret. Usage:
 *   node scripts/enable-payment-automatch.js <org-slug>
 */
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/enable-payment-automatch.js <org-slug>");
  process.exit(1);
}

function hash(raw) {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

async function main() {
  const db = new PrismaClient();
  const org = await db.organization.findUnique({ where: { slug } });
  if (!org) {
    console.error(`No organization with slug "${slug}"`);
    process.exit(1);
  }
  const raw = crypto.randomBytes(32).toString("hex");
  const updated = await db.organization.update({
    where: { id: org.id },
    data: {
      paymentAutoMatchEnabled: true,
      paymentWebhookSecretHash: hash(raw),
    },
  });
  console.log(`Enabled payment auto-match for ${updated.name} (${updated.slug})`);
  console.log(`Webhook: POST /api/webhooks/payments`);
  console.log(`Authorization: Bearer ${raw}`);
  console.log("(Store the Bearer secret now — only the hash is saved.)");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
