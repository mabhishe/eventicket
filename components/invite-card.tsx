"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { ShareButton } from "@/components/ShareButton";

/**
 * "I'm going" brag card + invite link. The invite URL carries ?invite= so
 * friends who buy through it are attributed to this order.
 */
export function InviteCard({
  eventTitle,
  eventSlug,
  inviteCode,
  friendCount,
  eventDateLabel,
  bannerUrl,
  logoUrl,
}: {
  eventTitle: string;
  eventSlug: string;
  inviteCode: string;
  friendCount: number;
  eventDateLabel: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const invitePath = `/e/${eventSlug}?invite=${inviteCode}`;
  const shareText = `🎉 I'm going to ${eventTitle}! ${eventDateLabel} — grab your tickets and join me:`;

  async function copyLink() {
    const full = `${window.location.origin}${invitePath}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${typeof window !== "undefined" ? window.location.origin + invitePath : invitePath}`)}`;

  return (
    <Card className="overflow-hidden text-center">
      {bannerUrl ? (
        <div className="relative -mx-5 -mt-5 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt={`${eventTitle} banner`}
            className="h-36 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={`${eventTitle} logo`}
              className="absolute bottom-2 left-4 h-12 w-12 rounded-xl border border-white/30 bg-white object-contain"
            />
          )}
          <p className="absolute bottom-3 left-20 right-4 text-left text-lg font-bold text-white drop-shadow">
            🎉 I&rsquo;m going!
          </p>
        </div>
      ) : (
        <>
          <p className="text-2xl">🎉</p>
          <h2 className="mt-1 text-lg font-bold">I&rsquo;m going!</h2>
        </>
      )}
      <p className="mt-1 text-sm text-zinc-500">
        {eventTitle} · {eventDateLabel}
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Show it off — and bring your friends along.
        {friendCount > 0 && (
          <>
            {" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {friendCount} {friendCount === 1 ? "friend has" : "friends have"}{" "}
              joined through your invite!
            </span>
          </>
        )}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <ShareButton
          url={invitePath}
          title={`I'm going to ${eventTitle}!`}
          text={shareText}
        />
        <a
          href={waHref}
          target="_blank"
          rel="noopener"
          className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied ✓" : "Copy invite link"}
        </button>
      </div>
      <p className="mt-3 break-all font-mono text-xs text-zinc-400">
        {invitePath}
      </p>
    </Card>
  );
}
