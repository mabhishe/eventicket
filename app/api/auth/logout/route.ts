import { NextResponse } from "next/server";
import { destroySession, clearActiveOrgCookie } from "@/lib/auth";

export async function POST() {
  await destroySession();
  await clearActiveOrgCookie();
  return NextResponse.json({ ok: true });
}
