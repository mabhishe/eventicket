"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Field,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
  ErrorNote,
} from "@/components/ui";
import { formatCents } from "@/lib/money";

type EventData = {
  ticketTypes: {
    id: string;
    name: string;
    priceCents: number;
    includesMeal: boolean;
    quantityTotal: number;
  }[];
  mealOptions: { id: string; name: string }[];
  currency: string;
};
type Availability = Record<
  string,
  { total: number; taken: number; left: number }
>;
type OrderItem = {
  id: string;
  qty: number;
  holderName: string | null;
  ticketType: { name: string };
  mealOption: { name: string } | null;
};

/**
 * Buyer-side management for unpaid orders: add tickets, edit details, cancel.
 * Shown on the public order page for PENDING_PAYMENT orders.
 */
export function PendingOrderActions({
  orderId,
  eventSlug,
  buyerName,
  buyerEmail,
  buyerPhone,
  items,
}: {
  orderId: string;
  eventSlug: string;
  buyerName: string;
  buyerEmail: string | null;
  buyerPhone: string | null;
  items: OrderItem[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "add" | "edit">("none");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // add tickets
  const [event, setEvent] = useState<EventData | null>(null);
  const [avail, setAvail] = useState<Availability>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [meals, setMeals] = useState<Record<string, string>>({});

  // edit details
  const [eName, setEName] = useState(buyerName);
  const [eEmail, setEEmail] = useState(buyerEmail || "");
  const [ePhone, setEPhone] = useState(buyerPhone || "");
  const [eHolders, setEHolders] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const i of items) out[i.id] = i.holderName || "";
    return out;
  });

  useEffect(() => {
    if (mode !== "add" || event) return;
    fetch(`/api/events/${encodeURIComponent(eventSlug)}`)
      .then((r) => r.json())
      .then((d) => {
        setEvent(d.event);
        setAvail(d.availability || {});
      })
      .catch(() => setError("Could not load ticket options"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const slots = useMemo(() => {
    if (!event) return [];
    const out: {
      key: string;
      ticketTypeId: string;
      typeName: string;
      includesMeal: boolean;
    }[] = [];
    for (const t of event.ticketTypes) {
      const q = qty[t.id] || 0;
      for (let i = 0; i < q; i++) {
        out.push({
          key: `${t.id}:${i}`,
          ticketTypeId: t.id,
          typeName: t.name,
          includesMeal: t.includesMeal,
        });
      }
    }
    return out;
  }, [event, qty]);

  const mealsRequired =
    event !== null && event.mealOptions.length > 0;
  const addTotal = event
    ? event.ticketTypes.reduce(
        (s, t) => s + (qty[t.id] || 0) * t.priceCents,
        0
      )
    : 0;

  async function submitAdd() {
    setError(null);
    if (slots.length === 0) {
      setError("Choose at least one ticket.");
      return;
    }
    for (const s of slots) {
      if (s.includesMeal && mealsRequired && !meals[s.key]) {
        setError(`Please choose a meal for every ${s.typeName} guest.`);
        return;
      }
    }
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-items",
        items: slots.map((s) => ({
          ticketTypeId: s.ticketTypeId,
          qty: 1,
          mealOptionId: meals[s.key] || null,
          holderName: (names[s.key] || "").trim() || null,
        })),
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not add tickets");
      return;
    }
    router.refresh();
  }

  async function submitEdit() {
    setError(null);
    if (!eName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!eEmail.trim() && !ePhone.trim()) {
      setError(
        "Please add an email or a phone number — you need one of them to find your order later."
      );
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-details",
        buyerName: eName,
        buyerEmail: eEmail,
        buyerPhone: ePhone,
        holderNames: eHolders,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not save changes");
      return;
    }
    router.refresh();
  }

  async function cancel() {
    if (
      !confirm(
        "Cancel this order? It will be removed and the spots freed up."
      )
    )
      return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not cancel order");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <h2 className="mb-3 font-semibold">Manage order</h2>
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-2">
        <button
          className={mode === "add" ? btnPrimary : btnSecondary}
          onClick={() => setMode(mode === "add" ? "none" : "add")}
        >
          Add tickets
        </button>
        <button
          className={mode === "edit" ? btnPrimary : btnSecondary}
          onClick={() => setMode(mode === "edit" ? "none" : "edit")}
        >
          Edit details
        </button>
        <button className={btnDanger} disabled={busy} onClick={cancel}>
          Cancel order
        </button>
      </div>

      {mode === "add" && (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {!event ? (
            <p className="text-sm text-zinc-500">Loading ticket options…</p>
          ) : (
            <>
              <div className="space-y-3">
                {event.ticketTypes.map((t) => {
                  const left = avail[t.id]?.left ?? t.quantityTotal;
                  const q = qty[t.id] || 0;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-zinc-500">
                          {formatCents(t.priceCents, event.currency)} ·{" "}
                          {left > 0 ? `${left} left` : "Sold out"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Remove one ${t.name}`}
                          className="h-11 w-11 rounded-lg border border-zinc-300 text-xl dark:border-zinc-700"
                          disabled={q === 0}
                          onClick={() =>
                            setQty({ ...qty, [t.id]: Math.max(0, q - 1) })
                          }
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-semibold">
                          {q}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add one ${t.name}`}
                          className="h-11 w-11 rounded-lg border border-zinc-300 text-xl dark:border-zinc-700"
                          disabled={left <= 0 || q >= left}
                          onClick={() => setQty({ ...qty, [t.id]: q + 1 })}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {slots.map((s, i) => (
                <div
                  key={s.key}
                  className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <p className="mb-2 text-sm font-medium">
                    Guest {i + 1} · {s.typeName}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name">
                      <input
                        className={inputCls}
                        value={names[s.key] || ""}
                        onChange={(e) =>
                          setNames({ ...names, [s.key]: e.target.value })
                        }
                        placeholder="Guest name"
                      />
                    </Field>
                    {s.includesMeal && mealsRequired && (
                      <Field label="Meal choice">
                        <select
                          className={inputCls}
                          value={meals[s.key] || ""}
                          onChange={(e) =>
                            setMeals({ ...meals, [s.key]: e.target.value })
                          }
                          required
                        >
                          <option value="">Select a meal…</option>
                          {event.mealOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </div>
                </div>
              ))}
              {slots.length > 0 && (
                <button
                  className={btnPrimary + " mt-4 w-full py-3"}
                  disabled={busy}
                  onClick={submitAdd}
                >
                  {busy
                    ? "Adding…"
                    : `Add to order — ${formatCents(addTotal, event.currency)}`}
                </button>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                Added tickets keep the same payment code — just update your
                transfer amount.
              </p>
            </>
          )}
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Field label="Your name">
            <input
              className={inputCls}
              value={eName}
              onChange={(e) => setEName(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input
                className={inputCls}
                type="email"
                value={eEmail}
                onChange={(e) => setEEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputCls}
                type="tel"
                value={ePhone}
                onChange={(e) => setEPhone(e.target.value)}
              />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Attendee names</p>
            <div className="space-y-2">
              {items.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                    {i.qty > 1 ? `${i.qty} × ` : ""}
                    {i.ticketType.name}
                    {i.mealOption ? ` · ${i.mealOption.name}` : ""}
                  </span>
                  <input
                    className={inputCls + " py-2"}
                    value={eHolders[i.id] ?? ""}
                    onChange={(e) =>
                      setEHolders({ ...eHolders, [i.id]: e.target.value })
                    }
                    placeholder="Guest name"
                    aria-label={`Guest name for ${i.ticketType.name}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <button
            className={btnPrimary + " w-full py-3"}
            disabled={busy}
            onClick={submitEdit}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </Card>
  );
}
