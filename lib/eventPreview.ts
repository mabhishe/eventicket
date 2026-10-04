/**
 * Short key for the fields a chat preview shows. It changes when the title,
 * date, place, or description changes, so a newly copied link is a new URL.
 * Chat apps keep the old card for a URL they have already previewed.
 */
export function eventPreviewVersion(input: {
  title: string;
  date: Date | string;
  venue?: string | null;
  description?: string | null;
}): string {
  const when = new Date(input.date);
  const date = Number.isNaN(when.getTime()) ? String(input.date) : when.toISOString();
  const raw = [
    input.title.trim(),
    date,
    (input.venue || "").trim(),
    (input.description || "").trim(),
  ].join("\n");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Add or replace the preview version without dropping invite or other params. */
export function withPreviewVersion(path: string, version: string): string {
  const splitAt = path.indexOf("?");
  const base = splitAt === -1 ? path : path.slice(0, splitAt);
  const params = new URLSearchParams(splitAt === -1 ? "" : path.slice(splitAt + 1));
  params.set("v", version);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
