"use client";

import { useState } from "react";
import { btnSecondary } from "@/components/ui";

/**
 * Share an order/ticket page: device share sheet where available, otherwise
 * copy the link to the clipboard.
 */
export function ShareButton({
  url,
  title = "My event tickets",
  text = "Here are my event tickets",
}: {
  url: string;
  title?: string;
  text?: string;
}) {
  const [label, setLabel] = useState("Share");

  async function share() {
    const full =
      typeof window !== "undefined" && url.startsWith("http")
        ? url
        : `${window.location.origin}${url}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text, url: full });
        return;
      } catch {
        // user dismissed the sheet or sharing failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(full);
      setLabel("Link copied ✓");
      setTimeout(() => setLabel("Share"), 2000);
    } catch {
      setLabel("Copy failed");
      setTimeout(() => setLabel("Share"), 2000);
    }
  }

  return (
    <button type="button" className={btnSecondary + " text-sm"} onClick={share}>
      {label}
    </button>
  );
}
