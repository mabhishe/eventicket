"use client";

import { useEffect, useState } from "react";
import { Field, inputCls, btnPrimary, ErrorNote } from "@/components/ui";

type Override = {
  id: string;
  metric: string;
  value: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";
  expiringSoon: boolean;
};

const METRIC_LABELS: Record<string, string> = {
  MONTHLY_BOOKINGS: "Bookings / month",
  MONTHLY_EMAILS: "Emails / month",
  MONTHLY_WHATSAPP: "WhatsApp / month",
  MAX_EVENTS: "Published events",
  MAX_SEATS: "Team seats",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Per-org temporary quota override manager for the platform panel.
 * SaaS owner only — never visible to the organization itself.
 */
export function TempOverridesManager({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<Override[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    metric: "MONTHLY_BOOKINGS",
    value: "",
    expiresAt: "",
    reason: "",
  });

  async function load() {
    const res = await fetch(`/api/platform/orgs/${orgId}/overrides`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load overrides");
      return;
    }
    setItems(data.overrides);
  }

  useEffect(() => {
    load();
  }, [orgId]);

  async function create() {
    setBusy(true);
    setError(null);
    setWarning(null);
    const res = await fetch(`/api/platform/orgs/${orgId}/overrides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metric: form.metric,
        value: form.value,
        expiresAt: form.expiresAt
          ? new Date(form.expiresAt + "T23:59:59").toISOString()
          : "",
        reason: form.reason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create override");
      setBusy(false);
      return;
    }
    if (data.warning) setWarning(data.warning);
    setForm({ metric: "MONTHLY_BOOKINGS", value: "", expiresAt: "", reason: "" });
    setBusy(false);
    await load();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this override? The org falls back to plan limits.")) {
      return;
    }
    setError(null);
    const res = await fetch(
      `/api/platform/orgs/${orgId}/overrides/${id}/revoke`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not revoke");
      return;
    }
    await load();
  }

  const active = items.filter((i) => i.status === "active");
  const history = items.filter((i) => i.status !== "active");

  return (
    <div className="space-y-4 py-2">
      <ErrorNote message={error} />
      {warning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {warning}
        </p>
      )}

      {active.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500">
              <th className="py-1 pr-3">Metric</th>
              <th className="py-1 pr-3">Raised to</th>
              <th className="py-1 pr-3">Reason</th>
              <th className="py-1 pr-3">Granted by</th>
              <th className="py-1 pr-3">Expires</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {active.map((o) => (
              <tr
                key={o.id}
                className="border-t border-stone-100 dark:border-stone-800"
              >
                <td className="py-2 pr-3 font-medium">
                  {METRIC_LABELS[o.metric] ?? o.metric}
                </td>
                <td className="py-2 pr-3">{o.value}</td>
                <td className="max-w-xs truncate py-2 pr-3 text-stone-500" title={o.reason}>
                  {o.reason}
                </td>
                <td className="py-2 pr-3 text-xs text-stone-500">{o.createdBy}</td>
                <td className="py-2 pr-3">
                  <span
                    className={
                      o.expiringSoon
                        ? "font-semibold text-amber-700 dark:text-amber-300"
                        : ""
                    }
                  >
                    {fmtDate(o.expiresAt)}
                    {o.expiringSoon && " · soon"}
                  </span>
                </td>
                <td className="py-2">
                  <button
                    className="text-xs underline"
                    onClick={() => revoke(o.id)}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-stone-500">No active temporary overrides.</p>
      )}

      <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
        <p className="mb-2 text-sm font-semibold">Grant temporary override</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Metric">
            <select
              className={inputCls}
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
            >
              {Object.entries(METRIC_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Raise to">
            <input
              className={inputCls + " w-24"}
              inputMode="numeric"
              placeholder="500"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label="Expires (end of day)">
            <input
              className={inputCls}
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </Field>
          <Field label="Reason (required)">
            <input
              className={inputCls + " w-64"}
              placeholder="e.g. CANOSA winter camp, 350 expected"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>
          <button
            className={btnPrimary + " px-3 py-1 text-sm"}
            disabled={busy}
            onClick={create}
          >
            Grant
          </button>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Temporary means temporary: expiry is mandatory, enforcement ignores
          expired rows automatically, and the org never sees this.
        </p>
      </div>

      {history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-500">
            History ({history.length} expired / revoked)
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-stone-500">
            {history.map((o) => (
              <li key={o.id}>
                {METRIC_LABELS[o.metric] ?? o.metric} → {o.value} ·{" "}
                {o.status} · expired {fmtDate(o.expiresAt)} · {o.reason} (
                {o.createdBy})
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
