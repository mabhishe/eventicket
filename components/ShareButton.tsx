"use client";

import { useState, type RefObject } from "react";
import { btnSecondary } from "@/components/ui";
import { sharePicture } from "@/components/share-image";

/**
 * Share an order/ticket page: device share sheet where available, otherwise
 * copy the link to the clipboard. When imageFile is ready, the picture is
 * attached so chat apps do not have to build a link preview.
 */
export function ShareButton({
  url,
  title = "My event tickets",
  text = "Here are my event tickets",
  imageFile,
}: {
  url: string;
  title?: string;
  text?: string;
  imageFile?: RefObject<File | null>;
}) {
  const [label, setLabel] = useState("Share");

  async function share() {
    const full =
      typeof window !== "undefined" && url.startsWith("http")
        ? url
        : `${window.location.origin}${url}`;
    const pictured = await sharePicture({
      file: imageFile?.current ?? null,
      title,
      text,
      url: full,
    });
    if (pictured === "shared" || pictured === "aborted") return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text, url: full });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // sharing failed — fall through to copy
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
