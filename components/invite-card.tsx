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
}: {
  eventTitle: string;
  eventSlug: string;
  inviteCode: string;
  friendCount: number;
  eventDateLabel: string;
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
    <Card className="text-center">
      <p className="text-2xl">🎉</p>
      <h2 className="mt-1 text-lg font-bold">I&rsquo;m going!</h2>
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
