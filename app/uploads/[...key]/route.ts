import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { stat, readFile, mkdir, rename, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { IMAGE_WIDTHS } from "@/lib/imageSizes";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const WIDTHS = new Set<number>(IMAGE_WIDTHS);

function uploadsDir() {
  return path.join(process.cwd(), "public", "uploads");
}

function safeResolved(key: string[]): string | null {
  if (
    !key ||
    key.length === 0 ||
    key.some(
      (s) =>
        !s ||
        s === "." ||
        s === ".." ||
        s.includes("/") ||
        s.includes("\\") ||
        s.includes("\0")
    )
  ) {
    return null;
  }
  const base = path.resolve(uploadsDir());
  const resolved = path.resolve(base, ...key);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

/**
 * Serve runtime-uploaded images (event logos, gallery, sponsor logos).
 *
 * Files land in public/uploads AFTER `next build`, which the production
 * server does not pick up from the static public manifest — so they are
 * served here straight from disk instead. Names are content hashes or
 * UUIDs, so the bytes never change and the response can be cached forever.
 *
 * `?w=480&fmt=webp` (or avif) returns a resized sibling, generated once
 * and reused. That is how older full-size PNGs shrink without a re-upload.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const resolved = safeResolved(key);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ext = path.extname(resolved).toLowerCase();
  if (!MIME[ext]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // /uploads/id/photo.w480.webp is not a file in public/. The original is.
  // Serving it here (not as a query string) keeps Next from returning the
  // full-size PNG from the public folder.
  const variantName = path.basename(resolved).match(/^(.*)\.w(480|960|1600)\.(webp|avif)$/);
  if (variantName) {
    const width = Number(variantName[2]);
    const format = variantName[3] as "webp" | "avif";
    if (!WIDTHS.has(width)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const source = await findSource(path.dirname(resolved), variantName[1]);
    if (!source || source.endsWith(".gif")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const generated = await ensureVariant(source, width, format, key);
    if (!generated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return fileResponse(generated, MIME[`.${format}`]);
  }

  try {
    const st = await stat(/*turbopackIgnore: true*/ resolved);
    if (!st.isFile()) throw new Error("not a file");
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buf = await readFile(/*turbopackIgnore: true*/ resolved);
  return fileResponse(buf, MIME[ext]);
}

const SOURCE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

async function findSource(dir: string, stem: string): Promise<string | null> {
  for (const ext of SOURCE_EXTS) {
    const candidate = path.join(/*turbopackIgnore: true*/ dir, `${stem}${ext}`);
    try {
      const st = await stat(/*turbopackIgnore: true*/ candidate);
      if (st.isFile()) return candidate;
    } catch {
      /* try the next extension */
    }
  }
  return null;
}

function fileResponse(buf: Buffer, type: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cachePath(key: string[]): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "upload-cache", ...key);
}

async function ensureVariant(
  source: string,
  width: number,
  format: "webp" | "avif",
  key: string[]
): Promise<Buffer | null> {
  const dest = cachePath(key);
  try {
    return await readFile(/*turbopackIgnore: true*/ dest);
  } catch {
    /* generate below */
  }
  try {
    const pipeline = sharp(source, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true });
    const buf =
      format === "avif"
        ? await pipeline.avif({ quality: 45 }).toBuffer()
        : await pipeline.webp({ quality: 72 }).toBuffer();
    await mkdir(/*turbopackIgnore: true*/ path.dirname(dest), { recursive: true });
    const tmp = `${dest}.${randomUUID()}.tmp`;
    await writeFile(/*turbopackIgnore: true*/ tmp, buf);
    await rename(/*turbopackIgnore: true*/ tmp, dest);
    return buf;
  } catch (e) {
    console.error("[uploads] variant failed", e instanceof Error ? e.message : e);
    return null;
  }
}
