import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { applySecurityHeaders, contentSecurityPolicy } from "@/lib/securityHeaders";

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

function isStaffPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/door");
}

export async function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy(nonce));

  if (isStaffPath(req.nextUrl.pathname)) {
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
      const redirect = NextResponse.redirect(new URL("/login", req.url));
      applySecurityHeaders(req, redirect, nonce);
      return redirect;
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applySecurityHeaders(req, response, nonce);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
