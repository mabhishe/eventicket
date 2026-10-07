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
import PlanCard from "@/components/plan-card";

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
  const [autoMatchAvailable, setAutoMatchAvailable] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/organization");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load settings");
      return;
    }
    const org = data.organization as Record<string, string | boolean | null>;
    const v: Record<string, string> = {};
    for (const f of FIELDS) v[f.key] = String(org[f.key] || "");
    setValues(v);
    setTimezone(String(org.timezone || "America/Toronto"));
    setBrandColor(String(org.brandColor || ""));
    setAutoMatchAvailable(!!org.paymentAutoMatchAvailable);
    setWebhookConfigured(!!org.paymentWebhookConfigured);
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

  async function rotateWebhookSecret() {
    setError(null);
    setNewWebhookSecret(null);
    setRotating(true);
    const res = await fetch("/api/admin/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotatePaymentWebhookSecret: true }),
    });
    const data = await res.json();
    setRotating(false);
    if (!res.ok) {
      setError(data.error || "Could not rotate webhook secret");
      return;
    }
    setWebhookConfigured(true);
    setNewWebhookSecret(String(data.paymentWebhookSecret || ""));
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
                  <p className="mt-1 text-xs text-stone-500">{f.hint}</p>
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
                  className="h-9 w-12 cursor-pointer rounded border border-stone-300"
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
            <p className="mt-1 text-xs text-stone-500">Used on tickets and public pages.</p></Field>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Default payment details</h2>
          <p className="mb-3 text-sm text-stone-500">
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
                  <p className="mt-1 text-xs text-stone-500">{f.hint}</p>
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
      {autoMatchAvailable && (
        <Card className="mt-6">
          <h2 className="mb-2 font-semibold">Payment auto-match</h2>
          <p className="mb-3 text-sm text-stone-500">
            Let an inbox bot POST Interac (or Zelle) deposit details to{" "}
            <code className="text-xs">/api/webhooks/payments</code>. Matching
            uses the payment code in the message, or sender email + amount when
            the code is missing. Generate a secret once and put it in the bot
            as a Bearer token.
          </p>
          <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">
            Webhook secret:{" "}
            {webhookConfigured ? "configured" : "not set yet"}
          </p>
          <button
            type="button"
            className={btnPrimary}
            disabled={rotating}
            onClick={rotateWebhookSecret}
          >
            {rotating
              ? "Generating…"
              : webhookConfigured
                ? "Rotate webhook secret"
                : "Generate webhook secret"}
          </button>
          {newWebhookSecret && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                Copy this secret now — it will not be shown again.
              </p>
              <code className="mt-2 block break-all text-xs">{newWebhookSecret}</code>
            </div>
          )}
        </Card>
      )}
      <div className="mt-6">
        <PlanCard />
      </div>
    </Container>
  );
}
