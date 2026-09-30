/**
 * Phase 1 (multi-tenant) data migration helper.
 *
 * Assigns every event that has no organization to a single default
 * Organization, and gives every user a Membership in that org based on
 * their platform role (ADMIN -> ORG_OWNER, SELLER -> ORG_STAFF, DOOR -> ORG_DOOR).
 *
 * Safe to run multiple times — it only touches rows that have no org yet.
 *
 * Usage:
 *   ORG_NAME="AiCloudConsult" DATABASE_URL="file:./dev.db" node scripts/backfill-orgs.js
 */
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

const ROLE_MAP = {
  ADMIN: "ORG_OWNER",
  SELLER: "ORG_STAFF",
  DOOR: "ORG_DOOR",
};

function slugify(name) {
  const base =
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "org";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

async function main() {
  const orgName = process.env.ORG_NAME || "My Organization";

  let org = await db.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!org) {
    org = await db.organization.create({
      data: { name: orgName, slug: slugify(orgName) },
    });
    console.log(`Created organization "${org.name}" (${org.id})`);
  } else {
    console.log(`Using existing organization "${org.name}" (${org.id})`);
  }

  const events = await db.event.updateMany({
    where: { organizationId: null },
    data: { organizationId: org.id },
  });
  console.log(`Assigned ${events.count} event(s) to "${org.name}"`);

  const users = await db.user.findMany({
    include: { memberships: { select: { id: true } } },
  });
  let memberships = 0;
  for (const user of users) {
    if (user.memberships.length > 0) continue;
    await db.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: ROLE_MAP[user.role] || "ORG_STAFF",
      },
    });
    memberships++;
  }
  console.log(`Created ${memberships} membership(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
