/** Value for <input type="datetime-local">, in the viewer's local timezone. */
export function toDatetimeLocalValue(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/**
 * Parse a datetime-local value ("YYYY-MM-DDTHH:mm", no timezone) as the
 * viewer's local time and return an ISO UTC string. Returns null when the
 * value is missing or not a real date.
 */
export function datetimeLocalToISO(value: string): string | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Event date for lists and public pages, in the organizer's timezone. */
export function formatEventWhen(
  d: Date | string,
  timeZone = "America/Toronto"
): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}
