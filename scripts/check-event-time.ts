/**
 * Event instants are stored in UTC. Public copy must use the event timezone
 * so a UTC server and a Toronto browser show the same clock time.
 *
 * Nov 1, 2026 17:00 UTC is 12:00 p.m. in America/Toronto (EST, UTC−5).
 */
import assert from "node:assert/strict";
import {
  datetimeLocalToISO,
  formatEventWhen,
  toDatetimeLocalValue,
} from "../lib/datetime";

const instant = new Date("2026-11-01T17:00:00.000Z");
const toronto = formatEventWhen(instant, "America/Toronto");
const utc = formatEventWhen(instant, "UTC");

assert.match(toronto, /12:00\s*p\.m\./i, toronto);
assert.match(toronto, /November 1, 2026/);
assert.doesNotMatch(toronto, /5:00/);
assert.match(utc, /5:00\s*p\.m\./i, utc);

// Summer: 16:00 UTC is noon in Toronto (EDT, UTC−4).
const summer = formatEventWhen("2026-07-01T16:00:00.000Z", "America/Toronto");
assert.match(summer, /12:00\s*p\.m\./i, summer);

// The wall clock an organizer types is the event zone, not the machine zone.
const iso = datetimeLocalToISO("2026-11-01T12:00", "America/Toronto");
assert.equal(iso, "2026-11-01T17:00:00.000Z");
assert.equal(
  toDatetimeLocalValue(instant, "America/Toronto"),
  "2026-11-01T12:00"
);

// An absolute ISO string is not reinterpreted.
assert.equal(
  datetimeLocalToISO("2026-11-01T17:00:00.000Z", "America/Toronto"),
  "2026-11-01T17:00:00.000Z"
);

// Missing zone still means Toronto, which is what existing events use.
assert.match(formatEventWhen(instant), /12:00\s*p\.m\./i);

console.log("event time checks passed");
console.log("toronto:", toronto);
console.log("utc:", utc);
