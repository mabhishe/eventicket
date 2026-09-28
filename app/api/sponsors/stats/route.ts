import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

// Abuse protection on the stat beacons: 60 per minute per IP.
const STATS_LIMIT = { limit: 60, windowMs: 60 * 1000 };

/**
 * Public beacon: records sponsor impressions and clicks.
 * Called via navigator.sendBeacon from SponsorsStrip when the strip scrolls
 * into view (impression, once per ad per page view) and when a sponsor link
 * is clicked. Only counts ads on PUBLISHED events.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`sponsor-stats:${clientIp(req)}`, STATS_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  let body: { impressions?: unknown; clicks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const impressions = Array.isArray(body.impressions)
    ? body.impressions.filter((x): x is string => typeof x === "string").slice(0, 100)
    : [];
  const clicks = Array.isArray(body.clicks)
    ? body.clicks.filter((x): x is string => typeof x === "string").slice(0, 100)
    : [];
  if (impressions.length === 0 && clicks.length === 0) {
    return NextResponse.json({ ok: true });
  }
  const published = { event: { status: "PUBLISHED" as const } };
  await Promise.all([
    ...impressions.map((id) =>
      db.sponsorAd.updateMany({
        where: { id, ...published },
        data: { impressions: { increment: 1 } },
      })
    ),
    ...clicks.map((id) =>
      db.sponsorAd.updateMany({
        where: { id, ...published },
        data: { clicks: { increment: 1 } },
      })
    ),
  ]);
  return NextResponse.json({ ok: true });
}
