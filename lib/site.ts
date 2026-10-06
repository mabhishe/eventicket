/** Public origin for canonical URLs, the sitemap, and Open Graph. */
export function siteOrigin(): string {
  const fromEnv = (process.env.APP_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://eventpass.aicloudconsult.com";
}

export const SITE_NAME = process.env.APP_NAME || "EventPass";
