"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Container,
  Card,
  PageTitle,
  Badge,
  btnSecondary,
  btnDanger,
  ErrorNote,
} from "@/components/ui";
import { formatCents, summarizePayments } from "@/lib/money";
import { OrderLedger, type LedgerOrder } from "@/components/order-ledger";
import { PaymentBotQueue } from "@/components/payment-bot-queue";

type OrderItem = {
  qty: number;
  unitPriceCents: number;
  holderName: string | null;
  medicalNotes: string | null;
  ticketType: { name: string };
  mealOption: { name: string } | null;
};
type Order = LedgerOrder & {
  buyerName: string;
  buyerEmail: string | null;
  buyerPhone: string | null;
  payMethod: string;
  notes: string | null;
  refCode: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  pickupAuth: string | null;
  waiverAcceptedAt: string | null;
  waiverSignedName: string | null;
  createdAt: string;
  event: { title: string; currency: string; timezone?: string | null };
  seller: { name: string } | null;
  items: OrderItem[];
  _count: { tickets: number };
};

const tone: Record<string, "amber" | "green" | "red" | "stone"> = {
  PENDING_PAYMENT: "amber",
  CONFIRMED: "green",
  CANCELLED: "red",
};

const PAGE_SIZE = 50;

function OrdersInner() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("PENDING_PAYMENT");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [buyerInput, setBuyerInput] = useState("");
  const [buyerQuery, setBuyerQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (filter !== "ALL") params.set("status", filter);
    if (buyerQuery) params.set("q", buyerQuery);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    if (res.ok) {
      setOrders(data.orders);
      setTotal(data.total ?? 0);
    } else setError(data.error || "Could not load orders");
  }, [filter, page, buyerQuery]);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuyerQuery(buyerInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [buyerInput]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function act(id: string, action: "confirm" | "cancel") {
    if (
      action === "cancel" &&
      !confirm("Cancel this order? Its tickets will be voided.")
    )
      return;
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/orders/${id}/${action}`, {
      method: "POST",
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "Action failed");
      return;
    }
    await load();
  }

  return (
    <Container>
      <PageTitle
        title="Orders"
        sub="Record each e-Transfer. Confirm only when the full amount is in. A short payment stays pending."
        action={
          <div className="flex gap-2">
            {["PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "ALL"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setPage(1);
                  setFilter(s);
                }}
                className={
                  filter === s
                    ? "rounded-lg bg-stone-900 px-3 py-2.5 text-xs font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
                    : "rounded-lg border border-stone-300 px-3 py-2.5 text-xs font-semibold dark:border-stone-700"
                }
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        }
      />
      <ErrorNote message={error} />
      <PaymentBotQueue onLinked={load} onError={setError} />
      <div className="mb-4">
        <input
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm dark:border-stone-700 dark:bg-stone-900"
          value={buyerInput}
          onChange={(e) => setBuyerInput(e.target.value)}
          placeholder="Search payment code, name, email, or phone…"
          aria-label="Search buyer"
        />
      </div>
      {(() => {
        const visible = orders;
        if (visible.length === 0) {
          return (
            <Card>
              <p className="text-sm text-stone-500">
                {buyerQuery
                  ? "No orders match. Switch the status filter to ALL if it may already be confirmed or cancelled."
                  : "No orders in this view."}
              </p>
            </Card>
          );
        }
        return (
          <div className="space-y-3">
            {visible.map((o) => (
            <Card
              key={o.id}
              className={
                highlight === o.id
                  ? "ring-2 ring-stone-900 dark:ring-stone-100"
                  : ""
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{o.buyerName}</p>
                    {o.refCode && (
                      <span
                        className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs font-bold tracking-widest dark:bg-stone-800"
                        title="Payment reference code — match it against the e-transfer message"
                      >
                        {o.refCode}
                      </span>
                    )}
                    <Badge tone={tone[o.status] ?? "stone"}>
                      {o.status.replace("_", " ")}
                    </Badge>
                    {o.emergencyAdmittedAt && o.status !== "CONFIRMED" && (
                      <Badge tone="amber">Emergency</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {o.event.title} ·{" "}
                    {o.items
                      .map(
                        (i) =>
                          `${i.qty} × ${i.ticketType.name}` +
                          (i.mealOption ? ` (${i.mealOption.name})` : "")
                      )
                      .join(", ")}
                  </p>
                  <p className="text-xs text-stone-400">
                    {o.payMethod}
                    {o.buyerEmail ? ` · ${o.buyerEmail}` : ""}
                    {o.buyerPhone ? ` · ${o.buyerPhone}` : ""}
                    {o.seller ? ` · sold by ${o.seller.name}` : ""}
                    {o._count.tickets > 0
                      ? ` · ${o._count.tickets} tickets issued`
                      : ""}
                  </p>
                  {o.notes && (
                    <p className="mt-1 text-xs text-stone-500">“{o.notes}”</p>
                  )}
                  {(o.emergencyName ||
                    o.pickupAuth ||
                    o.waiverAcceptedAt ||
                    o.items.some((i) => i.medicalNotes)) && (
                    <div className="mt-2 space-y-1 rounded-lg bg-stone-50 p-2 text-xs dark:bg-stone-800/50">
                      {o.emergencyName && (
                        <p>
                          <span className="font-semibold">🚨 Emergency:</span>{" "}
                          {o.emergencyName}
                          {o.emergencyPhone ? ` · ${o.emergencyPhone}` : ""}
                          {o.emergencyRelation
                            ? ` (${o.emergencyRelation})`
                            : ""}
                        </p>
                      )}
                      {o.pickupAuth && (
                        <p>
                          <span className="font-semibold">Pickup:</span>{" "}
                          {o.pickupAuth}
                        </p>
                      )}
                      {o.items
                        .filter((i) => i.medicalNotes)
                        .map((i, idx) => (
                          <p key={idx}>
                            <span className="font-semibold">⚕️ Medical</span>
                            {i.holderName ? ` (${i.holderName})` : ""}:{" "}
                            {i.medicalNotes}
                          </p>
                        ))}
                      {o.waiverAcceptedAt && (
                        <p>
                          <span className="font-semibold">
                            ✅ Waiver accepted
                          </span>
                          {o.waiverSignedName
                            ? ` by ${o.waiverSignedName}`
                            : ""}{" "}
                          ·{" "}
                          {new Date(o.waiverAcceptedAt).toLocaleDateString(
                            "en-CA"
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {formatCents(o.totalCents, o.event.currency)}
                  </span>
                  {o.status === "PENDING_PAYMENT" && (
                    <>
                      <button
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        disabled={
                          busy === o.id ||
                          !summarizePayments(o.payments, o.totalCents).canConfirm
                        }
                        title={
                          summarizePayments(o.payments, o.totalCents).canConfirm
                            ? "Issue tickets"
                            : "Record the full e-Transfer before confirming"
                        }
                        onClick={() => act(o.id, "confirm")}
                      >
                        {busy === o.id ? "…" : "Confirm payment"}
                      </button>
                      <button
                        className={btnDanger}
                        disabled={busy === o.id}
                        onClick={() => act(o.id, "cancel")}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {o.status === "CONFIRMED" && (
                    <>
                      <Link
                        href={`/order/${o.id}`}
                        className={btnSecondary + " text-xs"}
                      >
                        Tickets
                      </Link>
                      <button
                        className={btnSecondary + " text-xs"}
                        onClick={() => {
                          const url = `${window.location.origin}/order/${o.id}`;
                          navigator.clipboard
                            .writeText(url)
                            .then(() => alert("Ticket link copied"))
                            .catch(() => prompt("Copy ticket link:", url));
                        }}
                      >
                        Copy link
                      </button>
                      <button
                        className={btnDanger}
                        disabled={busy === o.id}
                        onClick={() => act(o.id, "cancel")}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
              <OrderLedger
                order={{ ...o, currency: o.event.currency, timeZone: o.event.timezone }}
                busy={busy === o.id}
                onChanged={load}
                onError={setError}
              />
              {o.payments.some((p) => p.kind === "RECEIVED" && !p.recordedBy) && (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Payment bot matched this order from an inbox deposit.
                </p>
              )}
            </Card>
            ))}
          </div>
        );
      })()}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-stone-500">
            Page {page} of {totalPages} · {total} orders
          </p>
          <div className="flex gap-2">
            <button
              className={btnSecondary + " text-xs"}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <button
              className={btnSecondary + " text-xs"}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </Container>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersInner />
    </Suspense>
  );
}
