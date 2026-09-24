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
import { formatCents } from "@/lib/money";

type OrderItem = {
  qty: number;
  unitPriceCents: number;
  ticketType: { name: string };
  mealOption: { name: string } | null;
};
type Order = {
  id: string;
  buyerName: string;
  buyerEmail: string | null;
  buyerPhone: string | null;
  status: string;
  payMethod: string;
  totalCents: number;
  notes: string | null;
  createdAt: string;
  event: { title: string };
  seller: { name: string } | null;
  items: OrderItem[];
  _count: { tickets: number };
};

const tone: Record<string, "amber" | "green" | "red" | "zinc"> = {
  PENDING_PAYMENT: "amber",
  CONFIRMED: "green",
  CANCELLED: "red",
};

function OrdersInner() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("PENDING_PAYMENT");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = filter === "ALL" ? "" : `?status=${filter}`;
    const res = await fetch(`/api/admin/orders${q}`);
    const data = await res.json();
    if (res.ok) setOrders(data.orders);
    else setError(data.error || "Could not load orders");
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

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
        sub="Confirm payment when the money arrives — tickets are issued automatically."
        action={
          <div className="flex gap-2">
            {["PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "ALL"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={
                  filter === s
                    ? "rounded-lg bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "rounded-lg border border-zinc-300 px-3 py-2.5 text-xs font-semibold dark:border-zinc-700"
                }
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        }
      />
      <ErrorNote message={error} />
      {orders.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No orders in this view.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card
              key={o.id}
              className={
                highlight === o.id
                  ? "ring-2 ring-zinc-900 dark:ring-zinc-100"
                  : ""
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{o.buyerName}</p>
                    <Badge tone={tone[o.status] ?? "zinc"}>
                      {o.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {o.event.title} ·{" "}
                    {o.items
                      .map(
                        (i) =>
                          `${i.qty} × ${i.ticketType.name}` +
                          (i.mealOption ? ` (${i.mealOption.name})` : "")
                      )
                      .join(", ")}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {o.payMethod}
                    {o.buyerEmail ? ` · ${o.buyerEmail}` : ""}
                    {o.buyerPhone ? ` · ${o.buyerPhone}` : ""}
                    {o.seller ? ` · sold by ${o.seller.name}` : ""}
                    {o._count.tickets > 0
                      ? ` · ${o._count.tickets} tickets issued`
                      : ""}
                  </p>
                  {o.notes && (
                    <p className="mt-1 text-xs text-zinc-500">“{o.notes}”</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {formatCents(o.totalCents)}
                  </span>
                  {o.status === "PENDING_PAYMENT" && (
                    <>
                      <button
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        disabled={busy === o.id}
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
            </Card>
          ))}
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
