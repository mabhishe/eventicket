"use client";

import { Fragment, useEffect, useState } from "react";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  btnPrimary,
  ErrorNote,
} from "@/components/ui";
import { TempOverridesManager } from "./temp-overrides-manager";

type Org = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string | null;
  maxEventsOverride: number | null;
  maxTicketsOverride: number | null;
  maxSeatsOverride: number | null;
  paymentAutoMatchEnabled: boolean;
  paymentWebhookConfigured: boolean;
  seats: number;
  publishedEvents: number;
  ownerEmail: string | null;
  createdAt: string;
};

export default function PlatformOrgsClient() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showTemp, setShowTemp] = useState<string | null>(null);
  const [form, setForm] = useState({
    plan: "FREE",
    maxEventsOverride: "",
    maxTicketsOverride: "",
    maxSeatsOverride: "",
    paymentAutoMatchEnabled: false,
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/platform/orgs");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load organizations");
      return;
    }
    setOrgs(data.organizations);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(o: Org) {
    setEditing(o.id);
    setForm({
      plan: o.plan,
      maxEventsOverride: o.maxEventsOverride?.toString() ?? "",
      maxTicketsOverride: o.maxTicketsOverride?.toString() ?? "",
      maxSeatsOverride: o.maxSeatsOverride?.toString() ?? "",
      paymentAutoMatchEnabled: o.paymentAutoMatchEnabled,
    });
    setError(null);
  }

  async function save(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/platform/orgs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: form.plan,
        maxEventsOverride: form.maxEventsOverride,
        maxTicketsOverride: form.maxTicketsOverride,
        maxSeatsOverride: form.maxSeatsOverride,
        paymentAutoMatchEnabled: form.paymentAutoMatchEnabled,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save");
      setBusy(false);
      return;
    }
    setEditing(null);
    setBusy(false);
    await load();
  }

  return (
    <Container>
      <PageTitle
        title="Platform admin"
        sub="Every organization. Set plans, grant Pro, override limits. Blank override = plan default."
      />
      <ErrorNote message={error} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500">
                <th className="py-2 pr-4">Organization</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Events</th>
                <th className="py-2 pr-4">Seats</th>
                <th className="py-2 pr-4">Overrides</th>
                <th className="py-2 pr-4">Pay match</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <Fragment key={o.id}>
                  <tr
                    className="border-t border-stone-100 dark:border-stone-800"
                  >
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{o.name}</div>
                    <div className="text-xs text-stone-500">
                      {o.ownerEmail || o.slug}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {editing === o.id ? (
                      <select
                        className={inputCls}
                        value={form.plan}
                        onChange={(e) =>
                          setForm({ ...form, plan: e.target.value })
                        }
                      >
                        <option value="FREE">Free</option>
                        <option value="PRO">Pro</option>
                      </select>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold dark:bg-stone-800">
                        {o.plan}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">{o.publishedEvents}</td>
                  <td className="py-3 pr-4">{o.seats}</td>
                  <td className="py-3 pr-4 text-xs text-stone-500">
                    {editing === o.id ? (
                      <div className="flex gap-2">
                        <Field label="Events">
                          <input
                            className={inputCls + " w-16"}
                            placeholder="—"
                            value={form.maxEventsOverride}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                maxEventsOverride: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Tickets">
                          <input
                            className={inputCls + " w-16"}
                            placeholder="—"
                            value={form.maxTicketsOverride}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                maxTicketsOverride: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Seats">
                          <input
                            className={inputCls + " w-16"}
                            placeholder="—"
                            value={form.maxSeatsOverride}
                            onChange={(e) =>
                              setForm({ ...form, maxSeatsOverride: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                    ) : o.maxEventsOverride != null ||
                      o.maxTicketsOverride != null ||
                      o.maxSeatsOverride != null ? (
                      [
                        o.maxEventsOverride != null &&
                          `${o.maxEventsOverride} events`,
                        o.maxTicketsOverride != null &&
                          `${o.maxTicketsOverride} tickets`,
                        o.maxSeatsOverride != null &&
                          `${o.maxSeatsOverride} seats`,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {editing === o.id ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.paymentAutoMatchEnabled}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              paymentAutoMatchEnabled: e.target.checked,
                            })
                          }
                        />
                        Pilot on
                      </label>
                    ) : o.paymentAutoMatchEnabled || o.plan === "PRO" ? (
                      <span className="text-stone-600 dark:text-stone-300">
                        {o.paymentAutoMatchEnabled ? "Pilot" : "Pro"}
                        {o.paymentWebhookConfigured ? " · secret set" : " · no secret"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3">
                    {editing === o.id ? (
                      <div className="flex gap-2">
                        <button
                          className={btnPrimary + " px-3 py-1 text-sm"}
                          disabled={busy}
                          onClick={() => save(o.id)}
                        >
                          Save
                        </button>
                        <button
                          className="px-3 py-1 text-sm underline"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          className="text-sm underline"
                          onClick={() => startEdit(o)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-sm underline"
                          onClick={() =>
                            setShowTemp(showTemp === o.id ? null : o.id)
                          }
                        >
                          {showTemp === o.id ? "Hide temp" : "Temp"}
                        </button>
                      </div>
                    )}
                  </td>
                  </tr>
                  {showTemp === o.id && (
                    <tr>
                      <td colSpan={7} className="bg-stone-50 px-4 dark:bg-stone-900/50">
                        <TempOverridesManager orgId={o.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!orgs.length && (
            <p className="py-4 text-sm text-stone-500">Loading…</p>
          )}
        </div>
      </Card>
    </Container>
  );
}
