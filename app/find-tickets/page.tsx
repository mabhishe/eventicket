"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  btnPrimary,
  ErrorNote,
} from "@/components/ui";

type Found = {
  orderId: string;
  eventTitle: string;
  eventDate: string;
  status: string;
  tickets: number;
};

export default function FindTicketsPage() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);

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
          title="Find my tickets"
          sub="Enter the name and the email or phone you used when ordering."
        />
        <Card>
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
                    <Link
                      key={o.orderId}
                      href={`/order/${o.orderId}`}
                      className="block rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <p className="font-medium">{o.eventTitle}</p>
                      <p className="text-sm text-zinc-500">
                        {new Intl.DateTimeFormat("en-CA", {
                          dateStyle: "medium",
                        }).format(new Date(o.eventDate))}{" "}
                        ·{" "}
                        {o.status === "CONFIRMED"
                          ? `${o.tickets} ticket(s)`
                          : "payment pending"}
                      </p>
                    </Link>
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
