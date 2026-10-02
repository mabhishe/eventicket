import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { copyFile, mkdir, rm } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { requireOrgApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

function slugify(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "event";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Copy a file that already belongs to this event. Returns the new public URL. */
async function copyEventFile(
  url: string | null | undefined,
  sourceEventId: string,
  destEventId: string
): Promise<string | null> {
  if (!url || !url.startsWith(`/uploads/${sourceEventId}/`)) return null;
  const rel = url.slice("/uploads/".length);
  if (rel.includes("..") || path.isAbsolute(rel)) return null;
  const src = path.join(process.cwd(), "public", "uploads", rel);
  const ext = path.extname(src).slice(1);
  if (!/^[a-z0-9]+$/i.test(ext)) return null;
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", destEventId);
  await mkdir(dir, { recursive: true });
  try {
    await copyFile(src, path.join(dir, filename));
  } catch {
    return null;
  }
  return `/uploads/${destEventId}/${filename}`;
}

/**
 * Copy the event setup into a new draft. Orders, tickets, and payments
 * stay on the original.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireOrgApiUser(req, ["ORG_OWNER", "ORG_ADMIN"]);
  if (!auth.ok) return auth.error;
  const { orgId } = auth.user;
  const { id } = await params;

  const source = await db.event.findFirst({
    where: { id, organizationId: orgId },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      mealOptions: { orderBy: { sortOrder: "asc" } },
      programItems: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      sponsorAds: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!source) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const created = await db.event.create({
    data: {
      title: source.title,
      slug: slugify(source.title),
      description: source.description,
      date: source.date,
      venue: source.venue,
      currency: source.currency,
      status: "DRAFT",
      etransferEmail: source.etransferEmail,
      zelleHandle: source.zelleHandle,
      cashNote: source.cashNote,
      brandColor: source.brandColor,
      requireEntryBeforeFood: source.requireEntryBeforeFood,
      organizationId: orgId,
      createdById: auth.user.id,
    },
  });

  try {
    const logoUrl = await copyEventFile(source.logoUrl, source.id, created.id);
    let gallery: string[] = [];
    try {
      const parsed = JSON.parse(source.imageUrls || "[]");
      if (Array.isArray(parsed)) {
        gallery = parsed.filter((u): u is string => typeof u === "string");
      }
    } catch {
      gallery = [];
    }
    const imageUrls: string[] = [];
    for (const url of gallery) {
      const copied = await copyEventFile(url, source.id, created.id);
      if (copied) imageUrls.push(copied);
    }

    await db.event.update({
      where: { id: created.id },
      data: { logoUrl, imageUrls: JSON.stringify(imageUrls) },
    });

    if (source.ticketTypes.length > 0) {
      await db.ticketType.createMany({
        data: source.ticketTypes.map((t) => ({
          eventId: created.id,
          name: t.name,
          description: t.description,
          priceCents: t.priceCents,
          quantityTotal: t.quantityTotal,
          includesMeal: t.includesMeal,
          sortOrder: t.sortOrder,
        })),
      });
    }
    if (source.mealOptions.length > 0) {
      await db.mealOption.createMany({
        data: source.mealOptions.map((m) => ({
          eventId: created.id,
          name: m.name,
          tag: m.tag,
          sortOrder: m.sortOrder,
        })),
      });
    }
    if (source.programItems.length > 0) {
      await db.programItem.createMany({
        data: source.programItems.map((p) => ({
          eventId: created.id,
          timeLabel: p.timeLabel,
          title: p.title,
          description: p.description,
          sortOrder: p.sortOrder,
        })),
      });
    }
    for (const ad of source.sponsorAds) {
      const imageUrl = await copyEventFile(ad.imageUrl, source.id, created.id);
      await db.sponsorAd.create({
        data: {
          eventId: created.id,
          name: ad.name,
          imageUrl,
          linkUrl: ad.linkUrl,
          tier: ad.tier,
          sortOrder: ad.sortOrder,
          impressions: 0,
          clicks: 0,
        },
      });
    }
  } catch {
    await db.event.delete({ where: { id: created.id } }).catch(() => {});
    await rm(path.join(process.cwd(), "public", "uploads", created.id), {
      recursive: true,
      force: true,
    }).catch(() => {});
    return NextResponse.json({ error: "Could not clone this event" }, { status: 500 });
  }

  const event = await db.event.findUnique({
    where: { id: created.id },
    include: { _count: { select: { orders: true } } },
  });
  return NextResponse.json({ event }, { status: 201 });
}
