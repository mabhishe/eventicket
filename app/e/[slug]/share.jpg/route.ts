import { eventShareJpeg, shareJpegResponse } from "@/lib/eventShareImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const jpeg = await eventShareJpeg(slug);
  return shareJpegResponse(jpeg);
}
