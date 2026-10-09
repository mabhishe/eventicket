"use client";

import { useState } from "react";
import { Card, Field, inputCls, btnPrimary } from "@/components/ui";
import {
  CAMP_PRESET,
  parseRegistrationFields,
  serializeRegistrationFields,
  REGISTRATION_FIELD_LABELS,
  type FieldMode,
  type RegistrationFields,
} from "@/lib/registrationFields";

const MODE_OPTIONS: { value: FieldMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
];

const FIELD_KEYS: (keyof typeof REGISTRATION_FIELD_LABELS)[] = [
  "emergencyContact",
  "medicalNotes",
  "pickupAuth",
  "waiver",
];

const FIELD_HINTS: Record<(typeof FIELD_KEYS)[number], string> = {
  emergencyContact: "Name + phone of someone to call in an emergency (per order).",
  medicalNotes: "Allergies, conditions, medication — collected per child.",
  pickupAuth: "Who is allowed to pick up the child (per order).",
  waiver: "Show your waiver/consent text; buyer checks a box and types their name.",
};

/**
 * "Registration fields" card for the event editor. Each module is
 * off/optional/required; the Camp preset flips the standard set to required.
 * Basic modules are free on all plans.
 */
export function RegistrationFieldsCard({
  initial,
  onSave,
}: {
  initial: string | null;
  onSave: (json: string | null) => Promise<boolean>;
}) {
  const [fields, setFields] = useState<RegistrationFields>(() =>
    parseRegistrationFields(initial)
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function set(key: keyof RegistrationFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setNote(null);
  }

  function applyPreset() {
    setFields({ ...CAMP_PRESET, waiverText: fields.waiverText });
    setDirty(true);
    setNote(null);
  }

  async function save() {
    setSaving(true);
    const ok = await onSave(serializeRegistrationFields(fields));
    setSaving(false);
    if (ok) {
      setDirty(false);
      setNote("Saved.");
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Registration fields</h2>
        <button
          type="button"
          className="rounded-lg border border-orange-300 px-3 py-1 text-sm font-semibold text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/40"
          onClick={applyPreset}
        >
          Apply camp preset
        </button>
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Extra questions at checkout — for camps, classes, and kids events.
        Each can be off, optional, or required. The camp preset marks the
        standard set required; you can relax any of them after.
      </p>
      <div className="space-y-3">
        {FIELD_KEYS.map((key) => (
          <div
            key={key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-800"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {REGISTRATION_FIELD_LABELS[key]}
              </p>
              <p className="text-xs text-stone-500">{FIELD_HINTS[key]}</p>
            </div>
            <div className="flex gap-1" role="radiogroup" aria-label={REGISTRATION_FIELD_LABELS[key]}>
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={fields[key] === m.value}
                  onClick={() => set(key, m.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    fields[key] === m.value
                      ? "bg-orange-600 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {fields.waiver !== "off" && (
          <Field label="Waiver / consent text (shown at checkout)">
            <textarea
              className={inputCls + " min-h-28"}
              placeholder="Paste your waiver or consent text here…"
              value={fields.waiverText}
              onChange={(e) => set("waiverText", e.target.value)}
            />
          </Field>
        )}
        {fields.waiver !== "off" && !fields.waiverText.trim() && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            ⚠️ Waiver is {fields.waiver} but no text is set. Buyers will see
            “The organizer has not added waiver text yet.”
            {fields.waiver === "required"
              ? " Required waivers with no text block checkout entirely."
              : ""}
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className={btnPrimary + " px-4 py-1.5 text-sm"}
          disabled={!dirty || saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Save registration fields"}
        </button>
        {note && <span className="text-sm text-stone-500">{note}</span>}
      </div>
    </Card>
  );
}
