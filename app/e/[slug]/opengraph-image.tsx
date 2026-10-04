import { db } from "@/lib/db";
import { eventShareSource, renderShareJpeg, SHARE_HEIGHT, SHARE_WIDTH } from "@/lib/eventShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Event";
export const size = { width: SHARE_WIDTH, height: SHARE_HEIGHT };
export const contentType = "image/jpeg";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    select: { status: true, imageUrls: true, logoUrl: true },
  });
  const source =
    event && event.status === "PUBLISHED"
      ? eventShareSource(event.imageUrls, event.logoUrl)
      : null;
  const jpeg = await renderShareJpeg(source);
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
