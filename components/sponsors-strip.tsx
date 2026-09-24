"use client";

export type SponsorAdInfo = {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string | null;
};

export function SponsorsStrip({ ads }: { ads: SponsorAdInfo[] }) {
  if (ads.length === 0) return null;
  return (
    <div className="mt-6 mb-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Our sponsors
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {ads.map((a) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.imageUrl}
              alt={a.name}
              title={a.name}
              loading="lazy"
              className="h-14 w-auto max-w-36 object-contain"
            />
          );
          return a.linkUrl ? (
            <a
              key={a.id}
              href={a.linkUrl}
              target="_blank"
              rel="noopener sponsored"
              aria-label={a.name}
              className="transition-opacity hover:opacity-80"
            >
              {img}
            </a>
          ) : (
            <span key={a.id} aria-label={a.name}>
              {img}
            </span>
          );
        })}
      </div>
    </div>
  );
}
