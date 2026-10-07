"use client";

import { useState } from "react";
import { formatCents, summarizePayments } from "@/lib/money";
import { btnDanger, btnSecondary } from "@/components/ui";

type PaymentRow = {
  id: string;
  kind: string;
  amountCents: number;
  method: string | null;
  reason: string | null;
  createdAt: string;
  recordedBy: { name: string } | null;
};

export type LedgerOrder = {
  id: string;
  status: string;
  totalCents: number;
  currency?: string;
  timeZone?: string | null;
  emergencyAdmittedAt: string | null;
  emergencyAdmitReason: string | null;
  emergencyAdmittedBy?: { name: string } | null;
  confirmedAt?: string | null;
  confirmedBy?: { name: string } | null;
  payments: PaymentRow[];
};

function fmtStamp(iso: string, timeZone?: string | null) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZone || "America/Toronto",
  }).format(new Date(iso));
}

const kindLabel: Record<string, string> = {
  RECEIVED: "Received",
  REFUND: "Refund",
  WAIVER: "Waiver",
};

export function OrderLedger({
  order,
  busy,
  onChanged,
  onError,
}: {
  order: LedgerOrder;
  busy: boolean;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const currency = order.currency || "CAD";
  const sum = summarizePayments(order.payments, order.totalCents);
  const [amount, setAmount] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [admitReason, setAdmitReason] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  async function post(url: string, body: unknown, key: string) {
    setWorking(key);
    onError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setWorking(null);
    if (!res.ok) {
      onError(data.error || "Could not update this order");
      return;
    }
    setAmount("");
    setAdjustAmount("");
    setAdjustReason("");
    setAdmitReason("");
    onChanged();
  }

  const locked = busy || working !== null;
  const showReceive = order.status === "PENDING_PAYMENT";

  return (
    <div className="mt-3 border-t border-stone-200 pt-3 dark:border-stone-800">
      <p className="text-sm">
        Received{" "}
        <strong>{formatCents(sum.net, currency)}</strong> of{" "}
        <strong>{formatCents(order.totalCents, currency)}</strong>
        {sum.balance > 0 ? ` · still owing ${formatCents(sum.balance, currency)}` : ""}
        {sum.waived > 0
          ? ` · waived ${formatCents(sum.waived, currency)} (does not replace payment)`
          : ""}
      </p>
      {order.payments.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-xs text-stone-500">
          {order.payments.map((p) => {
            const byBot = p.kind === "RECEIVED" && !p.recordedBy;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-1.5">
                <span>
                  {kindLabel[p.kind] || p.kind}{" "}
                  {formatCents(p.amountCents, currency)}
                  {p.method ? ` · ${p.method}` : ""}
                  {p.reason ? ` · ${p.reason}` : ""}
                  {p.recordedBy ? ` · ${p.recordedBy.name}` : ""}
                </span>
                {byBot && (
                  <span
                    className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                    title="Recorded automatically from an Interac/Zelle notification"
                  >
                    Payment bot
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {order.confirmedAt && (
        <p className="mt-1 text-xs text-stone-400">
          Confirmed {fmtStamp(order.confirmedAt, order.timeZone)}
          {order.confirmedBy
            ? ` by ${order.confirmedBy.name}`
            : " by payment bot"}
        </p>
      )}
      {order.emergencyAdmittedAt && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          Emergency admit {fmtStamp(order.emergencyAdmittedAt, order.timeZone)}
          {order.emergencyAdmittedBy ? ` by ${order.emergencyAdmittedBy.name}` : ""}
          {order.emergencyAdmitReason ? ` — ${order.emergencyAdmitReason}` : ""}
        </p>
      )}

      {showReceive && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            post(`/api/admin/orders/${order.id}/payments`, {
              kind: "RECEIVED",
              amount,
              method: "ETRANSFER",
            }, "receive");
          }}
        >
          <input
            className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            inputMode="decimal"
            placeholder="Amount"
            aria-label="Amount received"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className={btnSecondary} disabled={locked || !amount.trim()}>
            {working === "receive" ? "…" : "Record e-Transfer"}
          </button>
        </form>
      )}

      {showReceive && !order.emergencyAdmittedAt && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            post(`/api/admin/orders/${order.id}/emergency-admit`, {
              reason: admitReason,
            }, "admit");
          }}
        >
          <input
            className="min-w-48 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            placeholder="Why admit before the balance is paid"
            aria-label="Emergency admit reason"
            value={admitReason}
            onChange={(e) => setAdmitReason(e.target.value)}
          />
          <button className={btnDanger} disabled={locked || admitReason.trim().length < 8}>
            {working === "admit" ? "…" : "Emergency admit"}
          </button>
        </form>
      )}

      {order.status !== "CANCELLED" && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-stone-500">
            Refund or waive
          </summary>
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const kind = (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "data-kind"
              );
              if (kind !== "REFUND" && kind !== "WAIVER") return;
              post(`/api/admin/orders/${order.id}/payments`, {
                kind,
                amount: adjustAmount,
                reason: adjustReason,
              }, kind);
            }}
          >
            <input
              className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              inputMode="decimal"
              placeholder="Amount"
              aria-label="Refund or waiver amount"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
            />
            <input
              className="min-w-40 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              placeholder="Reason"
              aria-label="Refund or waiver reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
            <button
              type="submit"
              data-kind="REFUND"
              className={btnSecondary}
              disabled={locked}
            >
              {working === "REFUND" ? "…" : "Refund"}
            </button>
            <button
              type="submit"
              data-kind="WAIVER"
              className={btnSecondary}
              disabled={locked}
            >
              {working === "WAIVER" ? "…" : "Waive"}
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
