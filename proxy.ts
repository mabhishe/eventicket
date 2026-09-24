import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, getSecret());
      valid = true;
    } catch {
      valid = false;
    }
  }
  if (!valid) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/door/:path*"],
};
