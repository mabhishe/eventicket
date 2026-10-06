import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Public pages only. Login, staff, orders, and ticket codes stay out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const events = await db.event.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, createdAt: true },
    orderBy: { date: "asc" },
  });
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    ...events.map((event) => ({
      url: `${base}/e/${event.slug}`,
      lastModified: event.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
