/** Organizer default when an event has no zone of its own. */
export const DEFAULT_EVENT_TIMEZONE = "America/Toronto";

/** A zone Intl accepts, or America/Toronto. */
export function eventTimeZone(timeZone?: string | null): string {
  const tz = (timeZone || "").trim();
  if (!tz) return DEFAULT_EVENT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(0);
    return tz;
  } catch {
    return DEFAULT_EVENT_TIMEZONE;
  }
}

/** Offset of `timeZone` at `instant`, in milliseconds (wall = utc + offset). */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - instant.getTime();
}

/**
 * Interpret a datetime-local wall clock ("YYYY-MM-DDTHH:mm") in `timeZone`
 * and return the UTC instant. DST fall-back picks the earlier offset.
 */
export function zonedWallTimeToUtc(value: string, timeZone?: string | null): Date | null {
  const m = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] || "0");
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  const tz = eventTimeZone(timeZone);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = zoneOffsetMs(new Date(wallAsUtc), tz);
  let utc = wallAsUtc - first;
  const secondOffset = zoneOffsetMs(new Date(utc), tz);
  if (secondOffset !== first) utc = wallAsUtc - secondOffset;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Value for <input type="datetime-local">, in the event's timezone. */
export function toDatetimeLocalValue(d: Date, timeZone?: string | null): string {
  if (Number.isNaN(d.getTime())) return "";
  const tz = eventTimeZone(timeZone);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value])
  );
  const hour = String(Number(parts.hour) % 24).padStart(2, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/**
 * Parse a datetime-local value as the event timezone, or an absolute ISO
 * string (with Z or a numeric offset) as that instant. Returns an ISO UTC
 * string, or null when the value is missing or not a real date.
 */
export function datetimeLocalToISO(
  value: string,
  timeZone?: string | null
): string | null {
  const instant = parseEventInstant(value, timeZone);
  return instant ? instant.toISOString() : null;
}

/** Absolute ISO (has Z or ±hh:mm) stays absolute. A bare wall clock uses `timeZone`. */
export function parseEventInstant(value: string, timeZone?: string | null): Date | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) {
    return zonedWallTimeToUtc(v, timeZone);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Event date for lists, tickets, and emails, in the event's timezone. */
export function formatEventWhen(
  d: Date | string,
  timeZone?: string | null
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
    timeZone: eventTimeZone(timeZone),
  }).format(date);
}

/** Shorter event date for door lists and order lookup. */
export function formatEventWhenShort(
  d: Date | string,
  timeZone?: string | null
): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: eventTimeZone(timeZone),
  }).format(date);
}

/** True when the event has not finished for the purpose of the home list. */
export function isUpcomingEvent(d: Date | string, now = new Date()): boolean {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return false;
  // Keep an event on the home list for a few hours after it starts.
  return date.getTime() >= now.getTime() - 8 * 60 * 60 * 1000;
}
