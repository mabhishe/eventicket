import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;
  const ads = await db.sponsorAd.findMany({
    where: { eventId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ads });
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
  const name = String(form.get("name") || "").trim();
  const linkUrl = cleanLink(
    form.get("linkUrl") == null ? null : String(form.get("linkUrl"))
  );
  if (!name) return NextResponse.json({ error: "Sponsor name is required" }, { status: 400 });
  if (form.get("linkUrl") && !linkUrl) {
    return NextResponse.json(
      { error: "That website link doesn't look valid — try https://example.com" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "An image file is required" }, { status: 400 });
  }
  const stored = await storeFile(id, file);
  if (stored.error) return NextResponse.json({ error: stored.error }, { status: 400 });

  const count = await db.sponsorAd.count({ where: { eventId: id } });
  const ad = await db.sponsorAd.create({
    data: { eventId: id, name, imageUrl: stored.url!, linkUrl, sortOrder: count },
  });
  return NextResponse.json({ ad }, { status: 201 });
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
  const m = ad.imageUrl.match(/^\/uploads\/([^/]+)\/([^/]+)$/);
  if (m && m[1] === id) {
    try {
      await fs.unlink(path.join(eventDir(id), m[2]));
    } catch {
      /* file already gone */
    }
  }
  return NextResponse.json({ ok: true });
}
