import { createHash, randomUUID } from "crypto";
import path from "path";
import { mkdir, readdir, rename, unlink, writeFile } from "fs/promises";
import sharp, { type Sharp } from "sharp";
import { IMAGE_WIDTHS } from "./imageSizes";

export { IMAGE_WIDTHS };

const WEBP_QUALITY = 72;
const AVIF_QUALITY = 45;

function hashName(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 20);
}

async function writeVariant(
  filePath: string,
  image: Sharp,
  width: number,
  format: "webp" | "avif"
) {
  const pipeline = image.clone().resize({
    width,
    withoutEnlargement: true,
  });
  const buf =
    format === "avif"
      ? await pipeline.avif({ quality: AVIF_QUALITY }).toBuffer()
      : await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tmp, buf);
  await rename(tmp, filePath);
}

/**
 * Store an uploaded image as a content-hashed WebP plus width variants
 * (WebP and AVIF). Animated GIFs are stored as-is. Returns the public URL
 * of the canonical file.
 */
export async function storeOptimizedImage(
  dir: string,
  input: Buffer,
  publicPrefix: string
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const probed = sharp(input, { animated: true, failOn: "none" });
  const meta = await probed.metadata();
  const animated = meta.format === "gif" && (meta.pages || 1) > 1;
  if (animated) {
    const name = `${hashName(input)}.gif`;
    await writeFile(path.join(dir, name), input);
    return `${publicPrefix}/${name}`;
  }

  const oriented = sharp(input, { failOn: "none" }).rotate();
  const info = await oriented.metadata();
  const sourceWidth = info.width || 1600;
  const canonicalWidth = Math.min(sourceWidth, 1600);
  const canonical = await oriented
    .clone()
    .resize({ width: canonicalWidth, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const stem = hashName(canonical);
  await writeFile(path.join(dir, `${stem}.webp`), canonical);

  const widths = new Set<number>([canonicalWidth]);
  for (const w of IMAGE_WIDTHS) {
    if (w <= sourceWidth) widths.add(w);
  }
  for (const w of widths) {
    await writeVariant(path.join(dir, `${stem}.w${w}.webp`), oriented, w, "webp");
    await writeVariant(path.join(dir, `${stem}.w${w}.avif`), oriented, w, "avif");
  }
  return `${publicPrefix}/${stem}.webp`;
}

/** Remove a stored upload and any resized siblings next to it. */
export async function unlinkUpload(filePath: string) {
  const dir = path.dirname(filePath);
  const stem = path.basename(filePath, path.extname(filePath));
  await unlink(filePath).catch(() => {});
  const names = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    names
      .filter((n) => n === path.basename(filePath) || n.startsWith(`${stem}.w`))
      .map((n) => unlink(path.join(dir, n)).catch(() => {}))
  );
}
