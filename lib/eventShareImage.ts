import { db } from "@/lib/db";
import { eventShareSource, renderShareJpeg } from "@/lib/eventShare";

/** 1200×630 JPEG of the published event art, or a plain card when there is none. */
export async function eventShareJpeg(slug: string): Promise<Buffer> {
  const event = await db.event.findUnique({
    where: { slug },
    select: { status: true, imageUrls: true, logoUrl: true },
  });
  const source =
    event && event.status === "PUBLISHED"
      ? eventShareSource(event.imageUrls, event.logoUrl)
      : null;
  return renderShareJpeg(source);
}

export function shareJpegResponse(jpeg: Buffer): Response {
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpeg.length),
      // Filename ends in .jpg. WhatsApp uses that, plus the URL path, to accept the picture.
      "Content-Disposition": 'inline; filename="share.jpg"',
      "Cache-Control": "public, max-age=86400",
    },
  });
}
