import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { headers } from "next/headers";
import { formatEventWhen } from "@/lib/datetime";

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;

export { eventShareImagePath } from "@/lib/eventSharePath";

/** Browser tab and chat preview title. */
export function eventShareTitle(title: string): string {
  const name = title.trim() || "Event";
  return `${name} by EventPass`;
}

export function eventShareDescription(event: {
  date: Date;
  venue: string | null;
  description: string | null;
  timeZone?: string | null;
}): string {
  const when = formatEventWhen(event.date, event.timeZone || "America/Toronto");
  const place = event.venue ? `${when} · ${event.venue}` : when;
  const blurb = (event.description || "").replace(/\s+/g, " ").trim();
  const text = blurb ? `${place}. ${blurb}` : place;
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

/** First gallery image, otherwise the logo. Both are site-relative upload paths. */
export function eventShareSource(imageUrls: string, logoUrl: string | null): string | null {
  try {
    const parsed = JSON.parse(imageUrls || "[]");
    if (Array.isArray(parsed)) {
      const banner = parsed.find((u) => typeof u === "string" && u.startsWith("/uploads/"));
      if (banner) return banner;
    }
  } catch {
    /* ignore bad JSON */
  }
  if (logoUrl && logoUrl.startsWith("/uploads/")) return logoUrl;
  return null;
}

function uploadFile(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  const rel = url.slice("/uploads/".length);
  if (!rel || rel.split("/").some((p) => !p || p === "." || p === "..")) return null;
  const base = path.resolve(process.cwd(), "public", "uploads");
  const resolved = path.resolve(base, rel);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

/**
 * A 1200×630 JPEG of the event art, small enough for WhatsApp.
 * The full banner is often a multi-megabyte PNG; this stays under ~300 KB.
 */
export async function renderShareJpeg(imageUrl: string | null): Promise<Buffer> {
  const file = imageUrl ? uploadFile(imageUrl) : null;
  if (file) {
    try {
      const input = await readFile(file);
      let quality = 72;
      let jpeg = await sharp(input)
        .rotate()
        .resize(SHARE_WIDTH, SHARE_HEIGHT, { fit: "cover", position: "centre" })
        .jpeg({ quality })
        .toBuffer();
      while (jpeg.length > 300_000 && quality > 40) {
        quality -= 12;
        jpeg = await sharp(input)
          .rotate()
          .resize(SHARE_WIDTH, SHARE_HEIGHT, { fit: "cover", position: "centre" })
          .jpeg({ quality })
          .toBuffer();
      }
      return jpeg;
    } catch {
      /* missing file or unreadable image — plain card below */
    }
  }
  return sharp({
    create: {
      width: SHARE_WIDTH,
      height: SHARE_HEIGHT,
      channels: 3,
      background: { r: 28, g: 25, b: 23 },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
}

/** Host the visitor used, so chat apps request the image from the same site. */
export async function requestMetadataBase(): Promise<URL | undefined> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host")?.trim();
  if (!host) return undefined;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  try {
    return new URL(`${proto}://${host}`);
  } catch {
    return undefined;
  }
}
