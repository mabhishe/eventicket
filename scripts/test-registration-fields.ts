/** Lib-level assertions for the camp registration field modules. */
import assert from "node:assert";
import {
  CAMP_PRESET,
  REGISTRATION_FIELDS_DEFAULT,
  hasAnyRegistrationField,
  parseRegistrationFields,
  serializeRegistrationFields,
} from "../lib/registrationFields";

let n = 0;
function ok(cond: unknown, label: string) {
  n++;
  assert(cond, label);
  console.log(`ok ${n} - ${label}`);
}

// Defaults: everything off.
const d = parseRegistrationFields(null);
ok(d.emergencyContact === "off", "null parses to all-off");
ok(!hasAnyRegistrationField(d), "all-off has no fields");

// Camp preset shape.
ok(CAMP_PRESET.emergencyContact === "required", "preset: emergency required");
ok(CAMP_PRESET.medicalNotes === "required", "preset: medical required");
ok(CAMP_PRESET.pickupAuth === "required", "preset: pickup required");
ok(CAMP_PRESET.waiver === "required", "preset: waiver required");
ok(hasAnyRegistrationField(CAMP_PRESET), "preset has fields");

// Round-trip.
const rt = parseRegistrationFields(serializeRegistrationFields(CAMP_PRESET));
ok(JSON.stringify(rt) === JSON.stringify(CAMP_PRESET), "serialize/parse round-trips");

// Sanitization: garbage modes fall back to off; unknown keys ignored.
const dirty = parseRegistrationFields(
  JSON.stringify({ emergencyContact: "always", waiverText: "hi", evil: 1 })
);
ok(dirty.emergencyContact === "off", "invalid mode sanitized to off");
ok(dirty.waiverText === "hi", "waiver text preserved");
ok(
  JSON.stringify(dirty).indexOf("evil") === -1,
  "unknown keys dropped on serialize"
);

// Invalid JSON falls back to defaults.
ok(
  parseRegistrationFields("{nope").emergencyContact === "off",
  "invalid JSON falls back to defaults"
);

// Default constant matches parser output for null.
ok(
  JSON.stringify(REGISTRATION_FIELDS_DEFAULT) === JSON.stringify(d),
  "DEFAULT constant equals null parse"
);

console.log(`\nAll ${n} registration-field lib assertions passed.`);
