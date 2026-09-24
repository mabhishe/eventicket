"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  btnPrimary,
  Badge,
  ErrorNote,
} from "@/components/ui";
import { formatCents } from "@/lib/money";

type Found = {
  orderId: string;
  eventTitle: string;
  eventDate: string;
  status: string;
  tickets: number;
};

type SavedOrder = {
  id: string;
  status: string;
  totalCents: number;
  event: { title: string; date: string; currency: string };
  items: { qty: number; ticketType: { name: string } }[];
};

const tone: Record<string, "amber" | "green" | "red" | "zinc"> = {
  PENDING_PAYMENT: "amber",
  CONFIRMED: "green",
  CANCELLED: "red",
};

function savedOrderIds(): string[] {
  try {
    const raw = localStorage.getItem("eventpass:orders");
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function OrderRow({
  title,
  sub,
  status,
  total,
  orderId,
}: {
  title: string;
  sub: string;
  status: string;
  total: string;
  orderId: string;
}) {
  return (
    <Link
      href={`/order/${orderId}`}
      className="block rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        <Badge tone={tone[status] ?? "zinc"}>{status.replace("_", " ")}</Badge>
      </div>
      <p className="text-sm text-zinc-500">
        {sub}
        {total ? ` · ${total}` : ""}
      </p>
    </Link>
  );
}

export default function FindTicketsPage() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);

  const [saved, setSaved] = useState<SavedOrder[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);

  // Orders placed on this device — quick access without re-typing details.
  useEffect(() => {
    (async () => {
      const ids = savedOrderIds();
      const out: SavedOrder[] = [];
      for (const id of ids) {
        try {
          const res = await fetch(`/api/orders/${id}`);
          if (!res.ok) continue;
          const d = await res.json();
          out.push(d.order as SavedOrder);
        } catch {
          // skip orders that no longer load
        }
      }
      setSaved(out);
      setSavedLoaded(true);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSearched(false);
    const res = await fetch("/api/find-tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contact }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Lookup failed");
      return;
    }
    setOrders(data.orders || []);
    setSearched(true);
  }

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <PageTitle
          title="My bookings"
          sub="Orders you placed on this device, plus lookup for anything else."
        />

        {savedLoaded && saved.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 font-semibold">On this device</h2>
            <div className="space-y-2">
              {saved.map((o) => {
                const qty = o.items.reduce((s, i) => s + i.qty, 0);
                return (
                  <OrderRow
                    key={o.id}
                    orderId={o.id}
                    title={o.event.title}
                    sub={`${new Intl.DateTimeFormat("en-CA", {
                      dateStyle: "medium",
                    }).format(new Date(o.event.date))} · ${qty} ticket${
                      qty === 1 ? "" : "s"
                    }`}
                    status={o.status}
                    total={formatCents(o.totalCents, o.event.currency)}
                  />
                );
              })}
            </div>
          </div>
        )}

        <Card>
          <h2 className="mb-3 font-semibold">Look up an order</h2>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Your name">
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </Field>
            <Field label="Email or phone used for the order">
              <input
                className={inputCls}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <ErrorNote message={error} />
            <button className={btnPrimary + " w-full py-3"} disabled={busy}>
              {busy ? "Searching…" : "Find my tickets"}
            </button>
          </form>

          {searched && (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              {orders.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No orders found with those details. Check the spelling, or
                  ask the organizer for help.
                </p>
              ) : (
                <div className="space-y-2">
                  {orders.map((o) => (
                    <OrderRow
                      key={o.orderId}
                      orderId={o.orderId}
                      title={o.eventTitle}
                      sub={`${new Intl.DateTimeFormat("en-CA", {
                        dateStyle: "medium",
                      }).format(new Date(o.eventDate))} · ${
                        o.status === "CONFIRMED"
                          ? `${o.tickets} ticket(s)`
                          : "payment pending"
                      }`}
                      status={o.status}
                      total=""
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </Container>
  );
}
