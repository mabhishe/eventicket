"use client";

import { useEffect, useRef } from "react";

/** Load the JPEG once. The File has to exist before the tap, or iOS drops the share. */
export function useShareImage(url: string) {
  const fileRef = useRef<File | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch(url)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!cancel && blob) {
          fileRef.current = new File([blob], "share.jpg", { type: "image/jpeg" });
        }
      })
      .catch(() => {
        /* share falls back to the link */
      });
    return () => {
      cancel = true;
    };
  }, [url]);
  return fileRef;
}

/**
 * Attach the event picture when the phone allows it. The link stays in the
 * caption. Returns aborted when the person closes the sheet.
 */
export async function sharePicture(input: {
  file: File | null;
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "aborted" | "unavailable"> {
  const file = input.file;
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (!file || !nav?.share || !nav.canShare) return "unavailable";
  const payload = {
    files: [file],
    title: input.title,
    text: `${input.text.trim()}\n${input.url}`,
  };
  if (!nav.canShare(payload)) return "unavailable";
  try {
    await nav.share(payload);
    return "shared";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "aborted";
    return "unavailable";
  }
}
