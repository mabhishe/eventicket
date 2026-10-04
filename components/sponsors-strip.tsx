"use client";

import { useEffect, useMemo, useRef } from "react";
import { TIER_LABELS, TIER_LOGO_CLASS, sortSponsorAds } from "@/lib/sponsors";

export type SponsorAdInfo = {
  id: string;
  name: string;
  imageUrl: string | null;
  linkUrl: string | null;
  tier?: string | null;
};

const TIER_ORDER = ["GOLD", "SILVER", "BRONZE", "MENTION"] as const;

/** Fire-and-forget analytics beacon. Must never break the page. */
export function reportSponsorStats(ids: string[], kind: "impressions" | "clicks") {
  if (ids.length === 0) return;
  try {
    const body = JSON.stringify({ [kind]: ids });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/sponsors/stats",
        new Blob([body], { type: "application/json" })
      );
    } else {
      fetch("/api/sponsors/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

function AdLink({
  a,
  children,
  onClick,
}: {
  a: SponsorAdInfo;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return a.linkUrl ? (
    <a
      key={a.id}
      href={a.linkUrl}
      target="_blank"
      rel="noopener sponsored"
      aria-label={a.name}
      className="transition-opacity hover:opacity-80"
      onClick={onClick}
    >
      {children}
    </a>
  ) : (
    <span key={a.id} aria-label={a.name}>
      {children}
    </span>
  );
}

export function SponsorsStrip({
  ads,
  heading = "Our sponsors",
}: {
  ads: SponsorAdInfo[];
  heading?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reported = useRef<Set<string>>(new Set());

  // Count an impression when the strip actually scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el || ads.length === 0 || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const fresh = ads.map((a) => a.id).filter((id) => !reported.current.has(id));
          fresh.forEach((id) => reported.current.add(id));
          reportSponsorStats(fresh, "impressions");
          if (reported.current.size >= ads.length) obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ads]);

  const groups = useMemo(() => {
    const sorted = sortSponsorAds(ads);
    const out: { tier: string; items: SponsorAdInfo[] }[] = [];
    for (const t of TIER_ORDER) {
      const items = sorted.filter((a) => (a.tier || "SILVER") === t);
      if (items.length > 0) out.push({ tier: t, items });
    }
    // Anything with an unexpected tier value still shows up.
    const rest = sorted.filter(
      (a) => !TIER_ORDER.includes((a.tier || "SILVER") as (typeof TIER_ORDER)[number])
    );
    if (rest.length > 0) out.push({ tier: "SILVER", items: rest });
    return out;
  }, [ads]);

  if (groups.length === 0) return null;

  return (
    <div
      ref={ref}
      className="mt-6 mb-6 rounded-2xl border border-stone-200 p-4 dark:border-stone-800"
    >
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-400">
        {heading}
      </p>
      <div className="space-y-4">
        {groups.map(({ tier, items }) => (
          <div key={tier}>
            {groups.length > 1 && (
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                {TIER_LABELS[tier] || tier}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {items.map((a) => {
                const onClick = () => reportSponsorStats([a.id], "clicks");
                if (!a.imageUrl) {
                  const pill = (
                    <span className="rounded-full border border-amber-300/60 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                      {a.name}
                    </span>
                  );
                  return (
                    <AdLink key={a.id} a={a} onClick={onClick}>
                      {pill}
                    </AdLink>
                  );
                }
                const img = (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl || ""}
                    alt={a.name}
                    title={a.name}
                    loading="lazy"
                    className={`w-auto object-contain ${TIER_LOGO_CLASS[tier] || TIER_LOGO_CLASS.SILVER}`}
                  />
                );
                return (
                  <AdLink key={a.id} a={a} onClick={onClick}>
                    {img}
                  </AdLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
