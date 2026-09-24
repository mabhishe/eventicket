import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 12;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function eventDir(eventId: string) {
  return path.join(process.cwd(), "public", "uploads", eventId);
}

function urlToPath(url: string): string | null {
  // Only allow files inside this deployment's /uploads tree.
  if (!url.startsWith("/uploads/")) return null;
  const rel = url.slice("/uploads/".length);
  if (rel.includes("..") || path.isAbsolute(rel)) return null;
  return path.join(process.cwd(), "public", "uploads", rel);
}

function parseImageUrls(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Upload the event logo or a gallery image.
 * Form fields: file (image), kind ("logo" | "image").
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const kind = String(form.get("kind") || "");
  const file = form.get("file");
  if (kind !== "logo" && kind !== "image") {
    return NextResponse.json({ error: "kind must be logo or image" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file attached" }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Only JPG, PNG, WebP, or GIF images are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 5 MB or smaller" },
      { status: 400 }
    );
  }

  const images = parseImageUrls(event.imageUrls);
  if (kind === "image" && images.length >= MAX_IMAGES) {
    return NextResponse.json(
      { error: `At most ${MAX_IMAGES} images per event` },
      { status: 400 }
    );
  }

  const filename = `${randomUUID()}.${ext}`;
  const dir = eventDir(id);
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);
  const url = `/uploads/${id}/${filename}`;

  // Clean up the previous logo file so disk doesn't fill with orphans.
  if (kind === "logo" && event.logoUrl) {
    const oldPath = urlToPath(event.logoUrl);
    if (oldPath) await unlink(oldPath).catch(() => {});
  }

  const updated = await db.event.update({
    where: { id },
    data:
      kind === "logo"
        ? { logoUrl: url }
        : { imageUrls: JSON.stringify([...images, url]) },
  });
  return NextResponse.json(
    { url, logoUrl: updated.logoUrl, imageUrls: parseImageUrls(updated.imageUrls) },
    { status: 201 }
  );
}

/** Remove the logo or one gallery image. Body: { url }. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireApiUser(req, ["ADMIN"]);
  if (!auth.ok) return auth.error;
  const { id } = await params;

  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const url = String(body.url || "");
  if (!url.startsWith(`/uploads/${id}/`)) {
    return NextResponse.json({ error: "Unknown image" }, { status: 400 });
  }

  const images = parseImageUrls(event.imageUrls);
  const data =
    event.logoUrl === url
      ? { logoUrl: null as string | null }
      : { imageUrls: JSON.stringify(images.filter((u) => u !== url)) };
  const updated = await db.event.update({ where: { id }, data });

  const filePath = urlToPath(url);
  if (filePath) await unlink(filePath).catch(() => {});

  return NextResponse.json({
    logoUrl: updated.logoUrl,
    imageUrls: parseImageUrls(updated.imageUrls),
  });
}
