"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  btnPrimary,
  ErrorNote,
} from "@/components/ui";

const TIMEZONES = [
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

const FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "name", label: "Organization name" },
  { key: "tagline", label: "Tagline", hint: "Shown on your public pages." },
  { key: "supportEmail", label: "Support email", hint: "Buyers reply here with questions." },
  { key: "supportPhone", label: "Support phone" },
  { key: "etransferEmail", label: "e-Transfer email", hint: "Default payment address for new events." },
  { key: "zelleHandle", label: "Zelle handle", hint: "Default for new events." },
  { key: "cashNote", label: "Cash note", hint: "Default for new events." },
];

export default function OrgSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [timezone, setTimezone] = useState("America/Toronto");
  const [brandColor, setBrandColor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/organization");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load settings");
      return;
    }
    const org = data.organization as Record<string, string | null>;
    const v: Record<string, string> = {};
    for (const f of FIELDS) v[f.key] = org[f.key] || "";
    setValues(v);
    setTimezone(org.timezone || "America/Toronto");
    setBrandColor(org.brandColor || "");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function set(key: string, val: string) {
    setValues((p) => ({ ...p, [key]: val }));
    setSaved(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    const res = await fetch("/api/admin/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, timezone, brandColor }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save settings");
      return;
    }
    setSaved(true);
  }

  return (
    <Container>
      <PageTitle
        title="Organization settings"
        sub="Branding, support contact, and default payment details for your events."
      />
      <ErrorNote message={error} />
      {saved && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Settings saved.
        </p>
      )}
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Profile</h2>
          <div className="space-y-3">
            {FIELDS.slice(0, 4).map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  className={inputCls}
                  value={values[f.key] || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  required={f.key === "name"}
                  type={f.key.includes("Email") ? "email" : "text"}
                />
                {f.hint && (
                  <p className="mt-1 text-xs text-zinc-500">{f.hint}</p>
                )}
              </Field>
            ))}
            <Field label="Default timezone">
              <select
                className={inputCls}
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setSaved(false);
                }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Brand color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor || "#000000"}
                  onChange={(e) => {
                    setBrandColor(e.target.value);
                    setSaved(false);
                  }}
                  className="h-9 w-12 cursor-pointer rounded border border-zinc-300"
                />
                <input
                  className={inputCls}
                  value={brandColor}
                  onChange={(e) => {
                    setBrandColor(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="#1a73e8"
                />
              </div>
            <p className="mt-1 text-xs text-zinc-500">Used on tickets and public pages.</p></Field>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Default payment details</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Pre-filled when you create a new event. You can still override them
            per event.
          </p>
          <div className="space-y-3">
            {FIELDS.slice(4).map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  className={inputCls}
                  value={values[f.key] || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
                {f.hint && (
                  <p className="mt-1 text-xs text-zinc-500">{f.hint}</p>
                )}
              </Field>
            ))}
          </div>
        </Card>
        <div className="lg:col-span-2">
          <button className={btnPrimary} disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </Container>
  );
}
