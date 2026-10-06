import { IMAGE_WIDTHS } from "@/lib/imageSizes";

function variantUrl(src: string, width: number, format: "webp" | "avif"): string {
  const pathOnly = src.split("?")[0];
  const dot = pathOnly.lastIndexOf(".");
  const stem = dot === -1 ? pathOnly : pathOnly.slice(0, dot);
  return `${stem}.w${width}.${format}`;
}

/**
 * Event and sponsor images. Uploads get width variants so a phone does not
 * download a full-size PNG. Other URLs render as a plain image.
 */
export function ResponsiveImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
  width,
  height,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  width?: number;
  height?: number;
}) {
  if (!src.startsWith("/uploads/") || src.split("?")[0].endsWith(".gif")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }
  const webp = IMAGE_WIDTHS.map((w) => `${variantUrl(src, w, "webp")} ${w}w`).join(", ");
  const avif = IMAGE_WIDTHS.map((w) => `${variantUrl(src, w, "avif")} ${w}w`).join(", ");
  return (
    <picture>
      <source type="image/avif" srcSet={avif} sizes={sizes} />
      <source type="image/webp" srcSet={webp} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={variantUrl(src, 960, "webp")}
        alt={alt}
        className={className}
        width={width}
        height={height}
        sizes={sizes}
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}
