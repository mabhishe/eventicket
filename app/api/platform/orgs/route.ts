import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

async function requirePlatformAdmin(req: NextRequest) {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (!isPlatformAdmin(user?.email)) return null;
  return user;
}

/** List all organizations with plan + usage. Platform admins only. */
export async function GET(req: NextRequest) {
  const admin = await requirePlatformAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = checkRateLimit(`platform:${clientIp(req)}`, {
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const orgs = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          memberships: true,
          events: { where: { status: "PUBLISHED" } },
        },
      },
      memberships: {
        include: { user: { select: { email: true } } },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return NextResponse.json({
    organizations: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      subscriptionStatus: o.subscriptionStatus,
      maxEventsOverride: o.maxEventsOverride,
      maxTicketsOverride: o.maxTicketsOverride,
      maxSeatsOverride: o.maxSeatsOverride,
      seats: o._count.memberships,
      publishedEvents: o._count.events,
      ownerEmail: o.memberships[0]?.user.email ?? null,
      createdAt: o.createdAt,
    })),
  });
}
