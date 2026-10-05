import { appUrl } from "./email";
import { sortSponsorAds } from "./sponsors";

export type SponsorMailAd = {
  name: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  tier?: string | null;
  sortOrder?: number | null;
  createdAt?: Date | string;
};

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function httpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function absoluteAsset(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = appUrl();
  if (!base || !url.startsWith("/")) return null;
  return `${base}${url}`;
}

/** Gold sponsor cards for a buyer email. Empty when the event has no gold sponsors. */
export function goldSponsorEmailHtml(ads: SponsorMailAd[]): string {
  const gold = sortSponsorAds(ads).filter((a) => (a.tier || "SILVER") === "GOLD");
  if (gold.length === 0) return "";
  const cards = gold
    .map((a) => {
      const href = httpUrl(a.linkUrl);
      const image = absoluteAsset(a.imageUrl);
      const host = href ? new URL(href).hostname.replace(/^www\./, "") : "";
      const img = image
        ? `<img src="${esc(image)}" alt="" style="display:block;width:100%;max-height:120px;object-fit:contain;" />`
        : `<p style="margin:0;font-size:18px;font-weight:700;color:#1c1917;text-align:center;">${esc(a.name)}</p>`;
      const nameLine = image
        ? `<p style="margin:0;font-size:15px;font-weight:700;color:#1c1917;">${esc(a.name)}</p>`
        : "";
      const inner = `<div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:10px 12px;margin:0 0 8px;">${img}</div>
${nameLine}
${host ? `<p style="margin:2px 0 0;font-size:14px;color:#c2410c;text-decoration:underline;">${esc(host)}</p>` : ""}`;
      const block = `<div style="margin:0 0 14px;">${inner}</div>`;
      if (!href) return block;
      return `<a href="${esc(href)}" style="display:block;text-decoration:none;color:inherit;margin:0 0 14px;">${inner}</a>`;
    })
    .join("");
  return `<div style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e4e4e7;">
<p style="margin:0 0 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a1a1aa;">Gold sponsors</p>
${cards}</div>`;
}

/** Place the sponsor block above the email footer. A missing footer appends it. */
export function insertBeforeEmailFooter(html: string, block: string): string {
  if (!block) return html;
  const marker = `<div style="padding:16px 24px;border-top:1px solid #f4f4f5;">`;
  if (html.includes(marker)) return html.replace(marker, `${block}${marker}`);
  return `${html}${block}`;
}
