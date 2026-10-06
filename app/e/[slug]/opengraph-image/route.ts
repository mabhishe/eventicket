import { eventShareJpeg, shareJpegResponse } from "@/lib/eventShareImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** Older previews pointed here. New tags use /share.jpg, which WhatsApp will accept. */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  return shareJpegResponse(await eventShareJpeg(slug));
}
