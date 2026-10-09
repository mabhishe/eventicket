"use client";

import { useState } from "react";

const ICON = "h-4 w-4";

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={ICON} aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={ICON} aria-hidden>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={ICON} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={ICON} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ICON} aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ICON} aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ICON} aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98m-.01-10.98-6.82 3.98" />
    </svg>
  );
}

const btn =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition-colors hover:border-orange-300 hover:text-orange-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-orange-700 dark:hover:text-orange-400";

/**
 * Share row for the public event page: direct share links for the big
 * networks, native device share sheet (covers Instagram on mobile), and
 * copy-link fallback. Instagram has no web share URL, so its button copies
 * the link for pasting into the app.
 */
export function ShareEvent({
  slug,
  title,
  text,
}: {
  slug: string;
  title: string;
  text: string;
}) {
  const [note, setNote] = useState<string | null>(null);

  function canonical(): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/e/${slug}`;
  }

  function flash(msg: string) {
    setNote(msg);
    setTimeout(() => setNote(null), 2200);
  }

  async function copyLink(msg = "Link copied ✓") {
    try {
      await navigator.clipboard.writeText(canonical());
      flash(msg);
    } catch {
      flash("Copy failed — long-press the URL");
    }
  }

  async function instagramShare() {
    // Instagram has no web share URL. On phones the native share sheet
    // lists Instagram as a target, so prefer it; on desktop fall back to
    // copy-link for pasting into the app.
    if (canNativeShare) {
      try {
        await navigator.share({ title, text: shareText, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    copyLink("Link copied — paste it into Instagram");
  }

  function popup(href: string) {
    window.open(href, "_blank", "noopener,noreferrer,width=640,height=560");
  }

  const url = canonical();
  const shareText = text || title;

  const canNativeShare =
    typeof navigator !== "undefined" && "share" in navigator;

  async function nativeShare() {
    try {
      await navigator.share({ title, text: shareText, url });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      copyLink();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-stone-500">
        Share this event
      </span>
      <button
        type="button"
        className={btn}
        title="Share on Facebook"
        aria-label="Share on Facebook"
        onClick={() =>
          popup(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
          )
        }
      >
        <FacebookIcon />
      </button>
      <button
        type="button"
        className={btn}
        title="Share on X"
        aria-label="Share on X"
        onClick={() =>
          popup(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
          )
        }
      >
        <XIcon />
      </button>
      <button
        type="button"
        className={btn}
        title="Share on WhatsApp"
        aria-label="Share on WhatsApp"
        onClick={() =>
          popup(
            `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`
          )
        }
      >
        <WhatsAppIcon />
      </button>
      <button
        type="button"
        className={btn}
        title="Share on Instagram"
        aria-label="Share on Instagram"
        onClick={instagramShare}
      >
        <InstagramIcon />
      </button>
      <a
        className={btn}
        title="Share by email"
        aria-label="Share by email"
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n${url}`)}`}
      >
        <MailIcon />
      </a>
      <button
        type="button"
        className={btn}
        title="Copy event link"
        aria-label="Copy event link"
        onClick={() => copyLink()}
      >
        <LinkIcon />
      </button>
      {canNativeShare && (
        <button
          type="button"
          className={btn}
          title="More sharing options"
          aria-label="More sharing options"
          onClick={nativeShare}
        >
          <ShareIcon />
        </button>
      )}
      {note && (
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {note}
        </span>
      )}
    </div>
  );
}
