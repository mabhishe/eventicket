import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { stat, readFile } from "fs/promises";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function uploadsDir() {
  return path.join(process.cwd(), "public", "uploads");
}

/**
 * Serve runtime-uploaded images (event logos, gallery, sponsor logos).
 *
 * Files land in public/uploads AFTER `next build`, which the production
 * server does not pick up from the static public manifest — so they are
 * served here straight from disk instead. All stored filenames are UUIDs,
 * making them safe for long-lived immutable caching.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const base = path.resolve(uploadsDir());
  const resolved = path.resolve(base, ...key);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ext = path.extname(resolved).toLowerCase();
  const type = MIME[ext];
  if (!type) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const st = await stat(resolved);
    if (!st.isFile()) throw new Error("not a file");
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buf = await readFile(resolved);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
