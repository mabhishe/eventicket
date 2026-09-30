"use client";

import { useEffect, useState } from "react";
import { Card, ErrorNote } from "@/components/ui";

type Status = {
  plan: "FREE" | "PRO";
  planName: string;
  subscriptionStatus: string;
  hasBillingAccount: boolean;
  limits: {
    maxActiveEvents: number | null;
    maxTicketsPerEvent: number | null;
    maxSeats: number | null;
    showBadge: boolean;
  };
  usage: { activeEvents: number; seats: number; ticketsSold: number };
  proPriceCents: number;
};

function fmt(n: number | null): string {
  return n == null ? "Unlimited" : String(n);
}

export default function PlanCard() {
  const [st, setSt] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) setError(d.error || "Could not load plan");
        else setSt(d);
      })
      .catch(() => setError("Could not load plan"));
  }, []);

  async function manage() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not open billing portal");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal");
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold">Plan</h2>
      <ErrorNote message={error} />
      {!st ? (
        <p className="text-sm text-stone-500">Loading plan…</p>
      ) : (
        <div className="text-sm">
          <p className="mb-3">
            Current plan:{" "}
            <span className="rounded-full bg-stone-100 px-3 py-1 font-semibold dark:bg-stone-800">
              {st.planName}
            </span>
            {st.subscriptionStatus === "PAST_DUE" && (
              <span className="ml-2 text-amber-600">
                — payment past due, please update your card
              </span>
            )}
          </p>
          <ul className="mb-4 space-y-1 text-stone-600 dark:text-stone-400">
            <li>
              Published events: {st.usage.activeEvents} /{" "}
              {fmt(st.limits.maxActiveEvents)}
            </li>
            <li>
              Team seats: {st.usage.seats} / {fmt(st.limits.maxSeats)}
            </li>
            <li>Tickets sold (all events): {st.usage.ticketsSold}</li>
            <li>
              EventPass badge on public pages:{" "}
              {st.limits.showBadge ? "Shown" : "Removed"}
            </li>
          </ul>
          {st.plan === "FREE" ? (
            <div>
              <p className="inline-block rounded-lg bg-amber-100 px-4 py-2 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Pro — coming soon
              </p>
              <p className="mt-2 text-xs text-stone-500">
                Pro will bring unlimited events, tickets and team seats, with
                the EventPass badge removed. Online upgrade opens at launch.
              </p>
            </div>
          ) : (
            <button
              className="rounded-lg border border-stone-300 px-4 py-2 font-semibold dark:border-stone-700"
              onClick={manage}
              disabled={busy}
            >
              {busy ? "Opening…" : "Manage subscription"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
