import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidTier, normalizeTier, sortSponsorAds } from "@/lib/sponsors";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function eventDir(eventId: string) {
  return path.join(process.cwd(), "public", "uploads", eventId);
}

async function storeFile(eventId: string, file: File) {
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return { error: "Only JPG, PNG, WebP or GIF images are allowed" };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Image must be 5 MB or smaller" };
  }
  const dir = eventDir(eventId);
  await fs.mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, name), buf);
  return { url: `/uploads/${eventId}/${name}` };
}

function cleanLink(raw: string | null): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  // Be forgiving: "example.com" becomes "https://example.com".
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return withScheme;
  } catch {
    return null;
  }
}

/** "gold-sponsor_logo.png" -> "gold sponsor logo" */
function nameFromFilename(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, "");
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || "Sponsor";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;
  const ads = await db.sponsorAd.findMany({ where: { eventId: id } });
  return NextResponse.json({ ads: sortSponsorAds(ads) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const form = await req.formData();
  const tier = normalizeTier(form.get("tier"));
  const linkUrl = cleanLink(
    form.get("linkUrl") == null ? null : String(form.get("linkUrl"))
  );
  if (form.get("linkUrl") && !linkUrl) {
    return NextResponse.json(
      { error: "That website link doesn't look valid — try https://example.com" },
      { status: 400 }
    );
  }

  // Collect files: single "file" (back-compat) or multiple "files" (bulk).
  const files: File[] = [];
  for (const key of ["files", "file"]) {
    for (const v of form.getAll(key)) {
      if (v instanceof File && v.size > 0) files.push(v);
    }
  }

  const baseCount = await db.sponsorAd.count({ where: { eventId: id } });
  const created: unknown[] = [];

  if (files.length > 0) {
    // Bulk (or single) upload with images.
    const names = String(form.get("names") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const singleName = String(form.get("name") || "").trim();
    for (let i = 0; i < files.length; i++) {
      const stored = await storeFile(id, files[i]);
      if (stored.error) {
        return NextResponse.json(
          { error: `${files[i].name}: ${stored.error}` },
          { status: 400 }
        );
      }
      const adName =
        names[i] || (files.length === 1 ? singleName : "") || nameFromFilename(files[i].name);
      const ad = await db.sponsorAd.create({
        data: {
          eventId: id,
          name: adName,
          imageUrl: stored.url!,
          linkUrl,
          tier,
          sortOrder: baseCount + created.length,
        },
      });
      created.push(ad);
    }
    // Single-file uploads keep the old { ad } shape for back-compat.
    if (created.length === 1) return NextResponse.json({ ad: created[0] }, { status: 201 });
    return NextResponse.json({ ads: created }, { status: 201 });
  }

  // Text-only entry (used for special mentions without a logo).
  const name = String(form.get("name") || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Sponsor name is required (or choose logo images to bulk-add)" },
      { status: 400 }
    );
  }
  const ad = await db.sponsorAd.create({
    data: { eventId: id, name, imageUrl: null, linkUrl, tier, sortOrder: baseCount },
  });
  return NextResponse.json({ ad }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  // Accept multipart (logo replacement) or JSON (tier/name/link only).
  const ct = req.headers.get("content-type") || "";
  let get: (k: string) => string | null;
  let file: File | null = null;
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    get = (k: string) => {
      const v = form.get(k);
      return v == null ? null : String(v);
    };
    const f = form.get("file");
    if (f instanceof File && f.size > 0) file = f;
  } else {
    const body = await req.json().catch(() => ({}));
    get = (k: string) => (body[k] == null ? null : String(body[k]));
  }

  const adId = (get("id") || "").trim();
  if (!adId) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const ad = await db.sponsorAd.findFirst({ where: { id: adId, eventId: id } });
  if (!ad) return NextResponse.json({ error: "Sponsor ad not found" }, { status: 404 });

  const data: { tier?: string; name?: string; linkUrl?: string | null; imageUrl?: string | null } = {};
  const tier = get("tier");
  if (tier != null) {
    if (!isValidTier(tier)) {
      return NextResponse.json(
        { error: "tier must be GOLD, SILVER, BRONZE or MENTION" },
        { status: 400 }
      );
    }
    data.tier = tier;
  }
  const name = get("name");
  if (name != null) {
    if (!name.trim()) {
      return NextResponse.json({ error: "Sponsor name is required" }, { status: 400 });
    }
    data.name = name.trim();
  }
  const linkRaw = get("linkUrl");
  if (linkRaw != null) {
    const linkUrl = cleanLink(linkRaw);
    if (linkRaw.trim() && !linkUrl) {
      return NextResponse.json(
        { error: "That website link doesn't look valid — try https://example.com" },
        { status: 400 }
      );
    }
    data.linkUrl = linkUrl;
  }
  if (file) {
    const stored = await storeFile(id, file);
    if (stored.error) return NextResponse.json({ error: stored.error }, { status: 400 });
    data.imageUrl = stored.url!;
  }

  const updated = await db.sponsorAd.update({ where: { id: ad.id }, data });
  // Clean up the old logo file when it was replaced.
  if (file && ad.imageUrl) {
    const m = ad.imageUrl.match(/^\/uploads\/([^/]+)\/([^/]+)$/);
    if (m && m[1] === id) {
      try {
        await fs.unlink(path.join(eventDir(id), m[2]));
      } catch {
        /* file already gone */
      }
    }
  }
  return NextResponse.json({ ad: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const adId = String(body.id || "");
  if (!adId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const ad = await db.sponsorAd.findFirst({ where: { id: adId, eventId: id } });
  if (!ad) return NextResponse.json({ error: "Sponsor ad not found" }, { status: 404 });

  await db.sponsorAd.delete({ where: { id: ad.id } });
  const m = (ad.imageUrl || "").match(/^\/uploads\/([^/]+)\/([^/]+)$/);
  if (m && m[1] === id) {
    try {
      await fs.unlink(path.join(eventDir(id), m[2]));
    } catch {
      /* file already gone */
    }
  }
  return NextResponse.json({ ok: true });
}
