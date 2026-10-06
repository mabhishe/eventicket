import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/signup",
        "/admin",
        "/door",
        "/order",
        "/find-tickets",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/t/",
        "/api/",
      ],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
