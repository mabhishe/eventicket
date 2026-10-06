import { NextRequest, NextResponse } from "next/server";
import { loadPublicEvent } from "@/lib/publicEvent";

type Ctx = { params: Promise<{ slug: string }> };

/** Public: published event details + live availability for the buy page. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const data = await loadPublicEvent(slug);
  if (!data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
