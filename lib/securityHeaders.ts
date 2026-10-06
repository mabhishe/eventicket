import type { NextRequest, NextResponse } from "next/server";

const OFF = "()";

/**
 * Permissions-Policy. Camera is allowed only on the door console, where
 * staff scan ticket QR codes. Share stays available so guests can send a
 * ticket link. HSTS preload is intentionally not set: this policy is on
 * eventpass.aicloudconsult.com, not the apex, and preload is hard to undo.
 */
export function permissionsPolicy(pathname: string): string {
  const door = pathname === "/door" || pathname.startsWith("/door/");
  const camera = door ? "(self)" : OFF;
  return [
    `camera=${camera}`,
    `microphone=${OFF}`,
    `geolocation=${OFF}`,
    `payment=${OFF}`,
    `usb=${OFF}`,
    `bluetooth=${OFF}`,
    `accelerometer=${OFF}`,
    `gyroscope=${OFF}`,
    `magnetometer=${OFF}`,
    "fullscreen=(self)",
    "web-share=(self)",
  ].join(", ");
}

export function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  // style-src stays 'unsafe-inline' (no nonce). A nonce would make browsers
  // ignore 'unsafe-inline', and brand colors are set with style attributes.
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    connect-src 'self';
    media-src 'self' blob:;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'none';
    upgrade-insecure-requests;
  `;
  return csp.replace(/\s{2,}/g, " ").trim();
}

export function applySecurityHeaders(
  req: NextRequest,
  res: NextResponse,
  nonce: string
) {
  const csp = contentSecurityPolicy(nonce);
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-nonce", nonce);
  res.headers.set("Permissions-Policy", permissionsPolicy(req.nextUrl.pathname));
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
}
