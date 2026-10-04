"use client";

import { useEffect, useRef, useState } from "react";
import { cropFrame } from "@/lib/crop";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { TIER_LOGO_CLASS } from "@/lib/sponsors";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isAcceptedImage(file: File) {
  if (ACCEPT.includes(file.type)) return true;
  // Some pickers leave the type blank for a .jpeg named images.jpeg.
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

export function ImageCropDialog({
  file,
  aspect,
  outputWidth,
  title,
  hint,
  onCancel,
  onConfirm,
}: {
  file: File;
  aspect: number;
  outputWidth: number;
  title: string;
  hint: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [view, setView] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      imgRef.current = image;
      setError(null);
      setReady(true);
    };
    image.onerror = () => {
      if (!cancelled) setError("Could not read that image.");
    };
    image.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const image = imgRef.current;
  const frame =
    ready && image && view.w > 0 && view.h > 0
      ? cropFrame(image.naturalWidth, image.naturalHeight, view.w, view.h, zoom, pan.x, pan.y)
      : null;

  function setZoomClamped(next: number) {
    setZoom(next);
    if (!image || view.w === 0) return;
    const fitted = cropFrame(
      image.naturalWidth,
      image.naturalHeight,
      view.w,
      view.h,
      next,
      pan.x,
      pan.y
    );
    setPan(fitted.pan);
  }

  async function confirm() {
    const source = imgRef.current;
    const el = frameRef.current;
    if (!source || !el) return;
    const box = cropFrame(
      source.naturalWidth,
      source.naturalHeight,
      el.clientWidth,
      el.clientHeight,
      zoom,
      pan.x,
      pan.y
    );
    const keepPng = file.type === "image/png" || file.type === "image/webp";
    const mime = keepPng ? "image/png" : "image/jpeg";
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = Math.max(1, Math.round(outputWidth / aspect));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not crop this image.");
      return;
    }
    ctx.drawImage(source, box.sx, box.sy, box.sw, box.sh, 0, 0, canvas.width, canvas.height);
    setBusy(true);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, 0.92)
    );
    setBusy(false);
    if (!blob) {
      setError("Could not crop this image.");
      return;
    }
    const ext = mime === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    onConfirm(new File([blob], `${base}.${ext}`, { type: mime }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900"
      >
        <h2 id="crop-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-stone-500">{hint}</p>
        <div
          ref={frameRef}
          className="relative mt-3 w-full cursor-grab touch-none overflow-hidden rounded-xl bg-stone-200 active:cursor-grabbing dark:bg-stone-800"
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current || !image || view.w === 0) return;
            const fitted = cropFrame(
              image.naturalWidth,
              image.naturalHeight,
              view.w,
              view.h,
              zoom,
              drag.current.panX + (e.clientX - drag.current.x),
              drag.current.panY + (e.clientY - drag.current.y)
            );
            setPan(fitted.pan);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {frame && image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: frame.displayedWidth,
                height: frame.displayedHeight,
                left: frame.imageLeft,
                top: frame.imageTop,
              }}
            />
          )}
        </div>
        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-stone-500">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            className="mt-1 w-full"
            onChange={(e) => setZoomClamped(parseFloat(e.target.value))}
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!ready || busy}
            onClick={confirm}
          >
            {busy ? "Saving…" : "Use this crop"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SponsorLogoDialog({
  file,
  onCancel,
  onUse,
  onCrop,
}: {
  file: File;
  onCancel: () => void;
  onUse: () => void;
  onCrop: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sponsor-logo-title"
        className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900"
      >
        <h2 id="sponsor-logo-title" className="text-lg font-semibold">
          Sponsor logo
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          This is the size guests see. A wide PNG with a transparent background
          fits best. Extra empty margin makes the logo look smaller than its tier.
        </p>
        {url && (
          <div className="mt-4 flex flex-wrap items-end justify-center gap-6">
            <div className="text-center">
              <div className="flex h-24 w-48 items-center justify-center rounded-xl bg-stone-200 dark:bg-stone-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className={`w-auto object-contain ${TIER_LOGO_CLASS.GOLD}`}
                />
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Gold
              </p>
            </div>
            <div className="text-center">
              <div className="flex h-20 w-40 items-center justify-center rounded-xl bg-stone-200 dark:bg-stone-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className={`w-auto object-contain ${TIER_LOGO_CLASS.SILVER}`}
                />
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Silver
              </p>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={btnSecondary} onClick={onCrop}>
            Crop wide
          </button>
          <button type="button" className={btnPrimary} onClick={onUse}>
            Use this logo
          </button>
        </div>
      </div>
    </div>
  );
}
