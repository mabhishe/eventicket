"use client";

import { useEffect, useMemo, useRef } from "react";
import { sortSponsorAds } from "@/lib/sponsors";

export type SponsorAdInfo = {
  id: string;
  name: string;
  imageUrl: string | null;
  linkUrl: string | null;
  tier?: string | null;
  sortOrder?: number | null;
};

/** Gold is a tall banner. Silver and bronze use the same card, shorter. Mentions are a name. */
export type SponsorCardVariant = "gold" | "tier" | "mention";

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

function hostLabel(raw: string | null | undefined): string | null {
  const url = httpUrl(raw);
  if (!url) return null;
  return new URL(url).hostname.replace(/^www\./, "");
}

function AdLink({
  a,
  children,
  onClick,
  className,
}: {
  a: SponsorAdInfo;
  children: React.ReactNode;
  onClick?: () => void;
  className: string;
}) {
  const href = httpUrl(a.linkUrl);
  if (!href) {
    return (
      <div className={className} aria-label={a.name}>
        {children}
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener sponsored"
      aria-label={a.name}
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

function BannerCard({ a, tall }: { a: SponsorAdInfo; tall: boolean }) {
  const host = hostLabel(a.linkUrl);
  const height = tall ? "h-32" : "h-24";
  return (
    <>
      {a.imageUrl ? (
        <div className={`flex items-center justify-center rounded-xl bg-white px-3 ring-1 ring-stone-200 ${height}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.imageUrl} alt="" className="max-h-full w-full object-contain" />
        </div>
      ) : (
        <div className={`flex items-center justify-center rounded-xl bg-white px-4 ring-1 ring-stone-200 ${height}`}>
          <p className="text-center text-lg font-bold text-stone-900">{a.name}</p>
        </div>
      )}
      {a.imageUrl && (
        <p className="mt-3 text-base font-semibold text-stone-900 dark:text-stone-50">
          {a.name}
        </p>
      )}
      {host && (
        <p
          className={`text-sm text-orange-700 underline decoration-orange-700/40 underline-offset-2 dark:text-orange-300 ${
            a.imageUrl ? "mt-1" : "mt-3"
          }`}
        >
          {host}
        </p>
      )}
    </>
  );
}

function MentionRow({ a }: { a: SponsorAdInfo }) {
  const host = hostLabel(a.linkUrl);
  return (
    <>
      {a.imageUrl && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-stone-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-medium text-stone-900 dark:text-stone-50">{a.name}</span>
        {host && (
          <span className="block truncate text-sm text-orange-700 underline decoration-orange-700/40 underline-offset-2 dark:text-orange-300">
            {host}
          </span>
        )}
      </span>
    </>
  );
}

export function SponsorsStrip({
  ads,
  heading = "Our sponsors",
  variant = "tier",
}: {
  ads: SponsorAdInfo[];
  heading?: string;
  variant?: SponsorCardVariant;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reported = useRef<Set<string>>(new Set());
  const sorted = useMemo(() => sortSponsorAds(ads), [ads]);

  useEffect(() => {
    const el = ref.current;
    if (!el || sorted.length === 0 || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const fresh = sorted.map((a) => a.id).filter((id) => !reported.current.has(id));
          fresh.forEach((id) => reported.current.add(id));
          reportSponsorStats(fresh, "impressions");
          if (reported.current.size >= sorted.length) obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [sorted]);

  if (sorted.length === 0) return null;

  const cardClass =
    "block rounded-2xl border border-stone-200 bg-white p-3 text-left dark:border-stone-800 dark:bg-stone-900";
  const mentionClass =
    "flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left dark:border-stone-800 dark:bg-stone-900";

  return (
    <div ref={ref} className="mb-6">
      {heading && (
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-400">
          {heading}
        </p>
      )}
      <div className={variant === "mention" ? "space-y-2" : "space-y-3"}>
        {sorted.map((a) => {
          const onClick = () => reportSponsorStats([a.id], "clicks");
          if (variant === "mention") {
            return (
              <AdLink key={a.id} a={a} onClick={onClick} className={mentionClass}>
                <MentionRow a={a} />
              </AdLink>
            );
          }
          return (
            <AdLink key={a.id} a={a} onClick={onClick} className={cardClass}>
              <BannerCard a={a} tall={variant === "gold"} />
            </AdLink>
          );
        })}
      </div>
    </div>
  );
}
