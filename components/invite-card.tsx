"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { ShareButton } from "@/components/ShareButton";
import { sharePicture, useShareImage } from "@/components/share-image";
import { goingShareMessage } from "@/lib/goingShare";
import { eventShareImagePath } from "@/lib/eventSharePath";
import { withPreviewVersion } from "@/lib/eventPreview";

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
  venue,
  bannerUrl,
  logoUrl,
  previewVersion,
}: {
  eventTitle: string;
  eventSlug: string;
  inviteCode: string;
  friendCount: number;
  eventDateLabel: string;
  venue?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  /** Changes when the event date or title changes, so a new share is a new link. */
  previewVersion?: string;
}) {
  const [copied, setCopied] = useState(false);
  const invitePath = previewVersion
    ? withPreviewVersion(`/e/${eventSlug}?invite=${inviteCode}`, previewVersion)
    : `/e/${eventSlug}?invite=${inviteCode}`;
  const shareText = goingShareMessage({
    title: eventTitle,
    when: eventDateLabel,
    venue,
  });
  const imageFile = useShareImage(eventShareImagePath(eventSlug));

  function inviteUrl() {
    if (typeof window === "undefined") return invitePath;
    return `${window.location.origin}${invitePath}`;
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${inviteUrl()}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${inviteUrl()}`)}`;

  async function shareOnWhatsApp() {
    const pictured = await sharePicture({
      file: imageFile.current,
      title: `I'm going to ${eventTitle}!`,
      text: shareText,
      url: inviteUrl(),
    });
    if (pictured === "shared" || pictured === "aborted") return;
    window.open(waHref, "_blank", "noopener,noreferrer");
  }

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
      <p className="mt-3 whitespace-pre-line text-left text-sm text-stone-700 dark:text-stone-200">
        {shareText}
      </p>
      <p className="mt-2 text-sm text-stone-500">
        Show it off — and bring your friends along.
        {friendCount > 0 && (
          <>
            {" "}
            <span className="font-semibold text-stone-700 dark:text-stone-200">
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
          text={`${shareText}\n`}
          imageFile={imageFile}
        />
        <button
          type="button"
          onClick={shareOnWhatsApp}
          className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={copyMessage}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          {copied ? "Copied ✓" : "Copy message"}
        </button>
      </div>
    </Card>
  );
}
