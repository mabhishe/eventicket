/** Public JPEG for chat previews. The path ends in .jpg on purpose: WhatsApp skips images whose URL does not. */
export function eventShareImagePath(slug: string): string {
  return `/e/${encodeURIComponent(slug)}/share.jpg`;
}
