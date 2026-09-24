import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req);
  if (!auth.ok) return auth.error;
  return NextResponse.json({ user: auth.user });
}
