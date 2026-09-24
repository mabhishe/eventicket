"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  btnPrimary,
  ErrorNote,
} from "@/components/ui";
import { formatCents } from "@/lib/money";
import { SponsorsStrip, type SponsorAdInfo } from "@/components/sponsors-strip";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  quantityTotal: number;
  includesMeal: boolean;
};
type MealOption = { id: string; name: string; tag: string | null };
type Availability = Record<string, { left: number }>;
type EventData = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  venue: string | null;
  currency: string;
  etransferEmail: string | null;
  zelleHandle: string | null;
  cashNote: string | null;
  logoUrl: string | null;
  imageUrls: string;
  brandColor: string | null;
  sponsorAds: SponsorAdInfo[];
  programItems: ProgramItem[];
  ticketTypes: TicketType[];
  mealOptions: MealOption[];
};

const PAY_LABELS: Record<string, string> = {
  ETRANSFER: "Interac e-Transfer",
  ZELLE: "Zelle",
  CASH: "Cash",
};

type Slot = {
  key: string;
  ticketTypeId: string;
  typeName: string;
  includesMeal: boolean;
};

type ProgramItem = {
  id: string;
  timeLabel: string;
  title: string;
  description: string | null;
};

export default function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [avail, setAvail] = useState<Availability>({});
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [attendeeMeals, setAttendeeMeals] = useState<Record<string, string>>(
    {}
  );
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [payMethod, setPayMethod] = useState("ETRANSFER");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    params.then(async ({ slug }) => {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Event not found");
        return;
      }
      setEvent(data.event);
      setAvail(data.availability || {});
    });
  }, [params]);

  // One slot per ticket, so each guest gets a name + meal choice.
  const slots: Slot[] = useMemo(() => {
    if (!event) return [];
    const out: Slot[] = [];
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

  if (!event) {
    return (
      <Container>
        <ErrorNote message={error} />
        {!error && <p className="text-zinc-500">Loading…</p>}
      </Container>
    );
  }

  const totalCents = event.ticketTypes.reduce(
    (s, t) => s + (qty[t.id] || 0) * t.priceCents,
    0
  );

  let gallery: string[] = [];
  try {
    const g = JSON.parse(event.imageUrls || "[]");
    if (Array.isArray(g)) gallery = g.filter((x) => typeof x === "string");
  } catch {
    gallery = [];
  }

  const accent = event.brandColor || undefined;
  const payBtnStyle = accent ? { backgroundColor: accent } : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    for (const s of slots) {
      if (s.includesMeal && mealsRequired && !attendeeMeals[s.key]) {
        setError(`Please choose a meal for every ${s.typeName} guest.`);
        setBusy(false);
        return;
      }
    }

    const items = slots.map((s) => ({
      ticketTypeId: s.ticketTypeId,
      qty: 1,
      mealOptionId: attendeeMeals[s.key] || null,
      holderName: (names[s.key] || "").trim() || null,
    }));
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event!.id,
        buyerName,
        buyerEmail,
        buyerPhone,
        payMethod,
        items,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not place order");
      setBusy(false);
      return;
    }
    router.push(`/order/${data.order.id}`);
  }

  const payOptions = ["ETRANSFER", "ZELLE", "CASH"].filter((m) => {
    if (m === "ETRANSFER") return !!event.etransferEmail;
    if (m === "ZELLE") return !!event.zelleHandle;
    return !!event.cashNote;
  });

  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        {event.logoUrl && (
          <img
            src={event.logoUrl}
            alt={`${event.title} logo`}
            className="mb-4 h-16 w-auto max-w-full object-contain"
          />
        )}
        <PageTitle
          title={event.title}
          sub={
            new Intl.DateTimeFormat("en-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(event.date)) +
            (event.venue ? ` · ${event.venue}` : "")
          }
        />
        {event.description && (
          <Card className="mb-6">
            <p className="whitespace-pre-wrap text-sm">{event.description}</p>
          </Card>
        )}
        {(event.programItems || []).length > 0 && (
          <Card className="mb-6">
            <h2 className="mb-3 font-semibold">Program</h2>
            <ol className="space-y-3">
              {(event.programItems || []).map((p) => (
                <li key={p.id} className="flex gap-3">
                  {p.timeLabel && (
                    <span className="w-20 shrink-0 pt-0.5 text-xs font-semibold text-zinc-500">
                      {p.timeLabel}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.title}</p>
                    {p.description && (
                      <p className="whitespace-pre-wrap text-sm text-zinc-500">
                        {p.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
        {gallery.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {gallery.map((u) => (
              <img
                key={u}
                src={u}
                alt=""
                className="h-28 w-auto shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}
        <SponsorsStrip ads={event.sponsorAds || []} />

        <Card>
          <h2 className="mb-4 font-semibold">Choose tickets</h2>
          <div className="space-y-4">
            {event.ticketTypes.map((t) => {
              const left = avail[t.id]?.left ?? t.quantityTotal;
              const q = qty[t.id] || 0;
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      {t.description && (
                        <p className="text-sm text-zinc-500">{t.description}</p>
                      )}
                      <p className="mt-1 text-sm font-semibold">
                        {formatCents(t.priceCents, event.currency)}
                      </p>
                      <p className="text-xs text-zinc-400">
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
                      <span className="w-6 text-center font-semibold">{q}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${t.name}`}
                        className="h-11 w-11 rounded-lg border border-zinc-300 text-xl dark:border-zinc-700"
                        disabled={left <= 0 || q >= Math.min(left, 10)}
                        onClick={() => setQty({ ...qty, [t.id]: q + 1 })}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {slots.length > 0 && (
            <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <h3 className="mb-1 font-semibold">Who&rsquo;s coming?</h3>
              <p className="mb-4 text-sm text-zinc-500">
                Add each guest&rsquo;s name and meal choice.
              </p>
              <div className="space-y-3">
                {slots.map((s, i) => (
                  <div
                    key={s.key}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <p className="mb-2 text-sm font-medium">
                      Guest {i + 1} · {s.typeName}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name">
                        <input
                          className={inputCls}
                          placeholder={buyerName || "Guest name"}
                          value={names[s.key] || ""}
                          onChange={(e) =>
                            setNames({ ...names, [s.key]: e.target.value })
                          }
                        />
                      </Field>
                      {s.includesMeal && mealsRequired && (
                        <Field label="Meal choice">
                          <select
                            className={inputCls}
                            value={attendeeMeals[s.key] || ""}
                            onChange={(e) =>
                              setAttendeeMeals({
                                ...attendeeMeals,
                                [s.key]: e.target.value,
                              })
                            }
                            required
                          >
                            <option value="">Select a meal…</option>
                            {event.mealOptions.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                                {m.tag === "veg"
                                  ? " (veg)"
                                  : m.tag === "nonveg"
                                    ? " (non-veg)"
                                    : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={submit}
                className="mt-6 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800"
              >
                <h3 className="font-semibold">Your details</h3>
                <Field label="Full name">
                  <input
                    className={inputCls}
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    required
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email (for your tickets)">
                    <input
                      className={inputCls}
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className={inputCls}
                      type="tel"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="How will you pay?">
                  <select
                    className={inputCls}
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    {payOptions.map((m) => (
                      <option key={m} value={m}>
                        {PAY_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </Field>
                <ErrorNote message={error} />
                <button
                  className={btnPrimary + " w-full"}
                  style={payBtnStyle}
                  disabled={busy}
                >
                  {busy
                    ? "Placing order…"
                    : `Place order — ${formatCents(totalCents, event.currency)}`}
                </button>
                <p className="text-xs text-zinc-500">
                  You pay after placing the order. Your tickets are issued once
                  the organizer confirms your payment.
                </p>
              </form>
            </div>
          )}
        </Card>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already ordered?{" "}
          <a href="/find-tickets" className="font-semibold underline">
            Find my tickets
          </a>
        </p>
      </div>
    </Container>
  );
}
