"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, btnSecondary, btnDanger, btnPrimary } from "@/components/ui";
import { formatCents } from "@/lib/money";

type Intake = {
  id: string;
  externalId: string;
  method: string;
  amountCents: number;
  currency: string;
  message: string | null;
  senderName: string | null;
  senderEmail: string | null;
  status: string;
  createdAt: string;
};

export function PaymentBotQueue({
  onLinked,
  onError,
}: {
  onLinked: () => void;
  onError: (message: string | null) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  const [appliedToday, setAppliedToday] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/payment-intakes?status=NEEDS_REVIEW");
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || "Could not load payment bot queue");
      return;
    }
    setAvailable(!!data.available);
    setIntakes(data.intakes || []);
    setNeedsReviewCount(data.needsReviewCount ?? 0);
    setAppliedToday(data.appliedToday ?? 0);
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  if (!available) return null;

  async function ignore(id: string) {
    setBusy(id);
    onError(null);
    const res = await fetch(`/api/admin/payment-intakes/${id}/ignore`, {
      method: "POST",
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      onError(data.error || "Could not ignore this deposit");
      return;
    }
    await load();
  }

  async function link(id: string) {
    const refCode = (linkCode[id] || "").trim();
    if (!refCode) {
      onError("Enter the payment code to link this deposit");
      return;
    }
    setBusy(id);
    onError(null);
    const res = await fetch(`/api/admin/payment-intakes/${id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refCode }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      onError(data.error || "Could not link this deposit");
      return;
    }
    setLinkCode((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    await load();
    onLinked();
  }

  return (
    <div className="mb-6 space-y-3">
      <Card className="border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                Payment bot
              </p>
              <Badge tone="green">Watching inbox</Badge>
            </div>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              Auto-matches Interac deposits to pending orders.{" "}
              {appliedToday > 0
                ? `${appliedToday} matched today.`
                : "No matches yet today."}
              {needsReviewCount > 0
                ? ` ${needsReviewCount} need a human look.`
                : " Nothing waiting for review."}
            </p>
          </div>
          <Link
            href="/admin/settings"
            className={btnSecondary + " text-xs shrink-0"}
          >
            Webhook settings
          </Link>
        </div>
      </Card>

      {intakes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Needs review — bot couldn’t match uniquely
          </p>
          {intakes.map((i) => (
            <Card key={i.id} className="border-amber-200/70 dark:border-amber-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {formatCents(i.amountCents, i.currency || "CAD")}
                    <span className="ml-2 text-xs font-normal text-stone-500">
                      {i.method === "ZELLE" ? "Zelle" : "Interac"} · {i.externalId}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                    {i.senderName || "Unknown sender"}
                    {i.senderEmail ? ` · ${i.senderEmail}` : ""}
                  </p>
                  <p className="text-xs text-stone-500">
                    Message: {i.message?.trim() ? `“${i.message.trim()}”` : "(empty)"}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-64">
                  <input
                    className="rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm uppercase tracking-wider dark:border-stone-700 dark:bg-stone-900"
                    placeholder="Payment code (e.g. 3UMS7U)"
                    aria-label="Payment code to link"
                    value={linkCode[i.id] || ""}
                    onChange={(e) =>
                      setLinkCode((p) => ({ ...p, [i.id]: e.target.value }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnPrimary + " text-xs"}
                      disabled={busy === i.id}
                      onClick={() => link(i.id)}
                    >
                      {busy === i.id ? "…" : "Link to order"}
                    </button>
                    <button
                      type="button"
                      className={btnDanger + " text-xs"}
                      disabled={busy === i.id}
                      onClick={() => ignore(i.id)}
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
