"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  labelCls,
  btnPrimary,
  ErrorNote,
} from "@/components/ui";
import { formatCents } from "@/lib/money";
import { SponsorsStrip, type SponsorAdInfo } from "@/components/sponsors-strip";
import { eventPreviewVersion } from "@/lib/eventPreview";

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

function StepNum({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-700 align-middle text-xs font-bold text-white"
    >
      {n}
    </span>
  );
}

function MealPills({
  options,
  value,
  onChange,
  accent,
}: {
  options: MealOption[];
  value: string;
  onChange: (id: string) => void;
  accent?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            aria-pressed={active}
            className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              active
                ? "border-transparent text-white"
                : "border-stone-300 text-stone-600 hover:border-stone-400 dark:border-stone-700 dark:text-stone-300"
            }`}
            style={active ? { backgroundColor: accent || "#c2410c" } : undefined}
          >
            {active ? "✓ " : ""}
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

function PublicEventPageInner({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [slug, setSlug] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [avail, setAvail] = useState<Availability>({});
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [attendeeMeals, setAttendeeMeals] = useState<Record<string, string>>(
    {}
  );
  const [sameMeal, setSameMeal] = useState<Record<string, string>>({});
  const [sameMealOn, setSameMealOn] = useState<Record<string, boolean>>({});
  const [agreed, setAgreed] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [payMethod, setPayMethod] = useState("ETRANSFER");
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showBadge, setShowBadge] = useState(false);
  const [showOnWall, setShowOnWall] = useState(false);
  const [attendeeWall, setAttendeeWall] = useState<
    { name: string; partySize: number }[]
  >([]);

  // Prefill buyer details when returning from a "Buy more tickets" link.
  useEffect(() => {
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");
    if (name) setBuyerName(name);
    if (email) setBuyerEmail(email);
    if (phone) setBuyerPhone(phone);
    const invite = searchParams.get("invite");
    if (invite) setInviteCode(invite.trim().toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    params.then(async ({ slug: nextSlug }) => {
      setSlug(nextSlug);
      const res = await fetch(`/api/events/${encodeURIComponent(nextSlug)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Event not found");
        return;
      }
      setEvent(data.event);
      setAvail(data.availability || {});
      setShowBadge(data.showBadge !== false);
      setAttendeeWall(data.attendeeWall || []);
    });
  }, [params]);

  // Chat apps cache a preview for the exact URL. Put the current date in
  // the address bar so a link copied after a date change is a new URL.
  useEffect(() => {
    if (!event || !slug) return;
    const version = eventPreviewVersion({
      title: event.title,
      date: event.date,
      venue: event.venue,
      description: event.description,
    });
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("v") === version) return;
    params.set("v", version);
    router.replace(`/e/${slug}?${params.toString()}`, { scroll: false });
  }, [event, slug, router, searchParams]);

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
        {!error && <p className="text-stone-500">Loading…</p>}
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

    const slotsByType: Record<string, Slot[]> = {};
    for (const s of slots) {
      (slotsByType[s.ticketTypeId] ||= []).push(s);
    }
    for (const typeSlots of Object.values(slotsByType)) {
      const t0 = typeSlots[0];
      if (!t0.includesMeal || !mealsRequired) continue;
      if (sameMealOn[t0.ticketTypeId]) {
        if (!sameMeal[t0.ticketTypeId]) {
          setError(`Please choose the meal for ${t0.typeName} guests.`);
          setBusy(false);
          return;
        }
        continue;
      }
      if (typeSlots.some((s) => !attendeeMeals[s.key])) {
        setError(`Please choose a meal for every ${t0.typeName} guest.`);
        setBusy(false);
        return;
      }
    }
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      setBusy(false);
      return;
    }
    if (!buyerName.trim()) {
      setError("Please enter your name.");
      setBusy(false);
      return;
    }
    if (!buyerEmail.trim() && !buyerPhone.trim()) {
      setError(
        "Please add an email or a phone number — you need one of them to find your tickets later."
      );
      setBusy(false);
      return;
    }

    const items = slots.map((s) => ({
      ticketTypeId: s.ticketTypeId,
      qty: 1,
      mealOptionId:
        (sameMealOn[s.ticketTypeId] ? sameMeal[s.ticketTypeId] : attendeeMeals[s.key]) ||
        null,
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
        inviteCode: inviteCode || undefined,
        showOnWall,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not place order");
      setBusy(false);
      return;
    }
    // Keep the buyer's own orders on this device for "My bookings".
    try {
      const raw = localStorage.getItem("eventpass:orders");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const next = [data.order.id, ...ids.filter((x) => x !== data.order.id)];
      localStorage.setItem("eventpass:orders", JSON.stringify(next.slice(0, 20)));
    } catch {
      // localStorage unavailable — the order page link still works.
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
        {inviteCode && (
          <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            🎉 You&rsquo;ve been invited! Your friend is already going — grab
            your tickets below.
          </div>
        )}
        {gallery.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gallery[0]}
              alt={`${event.title} banner`}
              className="h-56 w-full object-cover sm:h-72"
            />
          </div>
        )}
        {(event.sponsorAds || []).some((a) => (a.tier || "SILVER") === "GOLD") && (
          <SponsorsStrip
            ads={(event.sponsorAds || []).filter((a) => (a.tier || "SILVER") === "GOLD")}
            heading="Presented by"
          />
        )}
        <div className="mb-4 flex items-center gap-4">
          {event.logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={event.logoUrl}
              alt={`${event.title} logo`}
              className="h-20 w-20 shrink-0 rounded-2xl border border-stone-200 object-contain dark:border-stone-800"
            />
          )}
          <div className="min-w-0">
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
          </div>
        </div>
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
                    <span className="w-20 shrink-0 pt-0.5 text-xs font-semibold text-stone-500">
                      {p.timeLabel}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.title}</p>
                    {p.description && (
                      <p className="whitespace-pre-wrap text-sm text-stone-500">
                        {p.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
        {gallery.length > 1 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {gallery.slice(1).map((u) => (
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
        {attendeeWall.length > 0 && (
          <Card className="mb-6">
            <h2 className="mb-1 font-semibold">
              Who&rsquo;s going 🎉{" "}
              <span className="text-sm font-normal text-stone-500">
                ({attendeeWall.reduce((s, a) => s + a.partySize, 0)} attending)
              </span>
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {attendeeWall.map((a, i) => (
                <span
                  key={i}
                  title={`${a.name} · party of ${a.partySize}`}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 py-1 pl-1 pr-3 text-sm dark:border-stone-800"
                >
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      backgroundColor: `hsl(${(i * 47) % 360} 60% 45%)`,
                    }}
                  >
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                  {a.name}
                  {a.partySize > 1 && (
                    <span className="text-xs text-stone-500">+{a.partySize - 1}</span>
                  )}
                </span>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="mb-4 text-lg font-bold">
            <StepNum n={1} /> Choose tickets
          </h2>
          <div className="space-y-4">
            {event.ticketTypes.map((t) => {
              const left = avail[t.id]?.left ?? t.quantityTotal;
              const q = qty[t.id] || 0;
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-stone-200 p-4 dark:border-stone-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      {t.description && (
                        <p className="text-sm text-stone-500">{t.description}</p>
                      )}
                      <p className="mt-1 text-sm font-semibold">
                        {formatCents(t.priceCents, event.currency)}
                      </p>
                      <p className="text-xs text-stone-400">
                        {left > 0 ? `${left} left` : "Sold out"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Remove one ${t.name}`}
                        className="h-11 w-11 rounded-lg border border-stone-300 text-xl dark:border-stone-700"
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
                        className="h-11 w-11 rounded-lg border border-stone-300 text-xl dark:border-stone-700"
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
            <div className="mt-6 border-t border-stone-200 pt-6 dark:border-stone-800">
              <h3 className="mb-1 text-lg font-bold">
                <StepNum n={2} /> Who&rsquo;s coming?
              </h3>
              <p className="mb-4 text-sm text-stone-500">
                Add each guest&rsquo;s name and meal choice.
              </p>
              {mealsRequired &&
                event.ticketTypes
                  .filter((t) => t.includesMeal && (qty[t.id] || 0) > 0)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="mb-4 rounded-xl bg-orange-50/70 p-3 dark:bg-stone-800/60"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          Meal for each {t.name}
                        </p>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!sameMealOn[t.id]}
                          onClick={() =>
                            setSameMealOn({
                              ...sameMealOn,
                              [t.id]: !sameMealOn[t.id],
                            })
                          }
                          className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300"
                        >
                          <span
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                              sameMealOn[t.id] ? "bg-orange-700" : "bg-stone-300 dark:bg-stone-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                sameMealOn[t.id] ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </span>
                          Same meal for all
                        </button>
                      </div>
                      {sameMealOn[t.id] && (
                        <MealPills
                          options={event.mealOptions}
                          value={sameMeal[t.id] || ""}
                          onChange={(id) =>
                            setSameMeal({ ...sameMeal, [t.id]: id })
                          }
                          accent={accent}
                        />
                      )}
                    </div>
                  ))}
              <div className="space-y-3">
                {slots.map((s, i) => (
                  <div
                    key={s.key}
                    className="rounded-lg border border-stone-200 p-3 dark:border-stone-800"
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
                      {s.includesMeal && mealsRequired && !sameMealOn[s.ticketTypeId] && (
                        <div>
                          <span className={labelCls}>Meal choice</span>
                          <div className="mt-1">
                            <MealPills
                              options={event.mealOptions}
                              value={attendeeMeals[s.key] || ""}
                              onChange={(id) =>
                                setAttendeeMeals({
                                  ...attendeeMeals,
                                  [s.key]: id,
                                })
                              }
                              accent={accent}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <form
                id="checkout-form"
                onSubmit={submit}
                className="mt-6 space-y-4 border-t border-stone-200 pt-6 dark:border-stone-800"
              >
                <h3 className="text-lg font-bold">
                  <StepNum n={3} /> Your details
                </h3>
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
                <p className="-mt-2 text-xs text-stone-500">
                  At least one of email or phone is needed so you can find your
                  order later.
                </p>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                  <input
                    type="checkbox"
                    checked={showOnWall}
                    onChange={(e) => setShowOnWall(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="text-sm">
                    <span className="font-medium">
                      Show me on the &ldquo;Who&rsquo;s going&rdquo; wall 🎉
                    </span>
                    <br />
                    <span className="text-stone-500">
                      Your first name and party size appear publicly so friends
                      can see you&rsquo;re going.
                    </span>
                  </span>
                </label>
                <h3 className="pt-2 text-lg font-bold">
                  <StepNum n={4} /> Payment
                </h3>
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
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-orange-700"
                  />
                  <span className="text-sm text-stone-600 dark:text-stone-300">
                    I agree to EventPass&rsquo;s{" "}
                    <a href="/terms" className="font-medium underline">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" className="font-medium underline">
                      Privacy Policy
                    </a>
                    . Payment is made directly to the organizer — not to
                    EventPass.
                  </span>
                </label>
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
                <p className="text-xs text-stone-500">
                  You pay after placing the order. Your tickets are issued once
                  the organizer confirms your payment.
                </p>
              </form>
            </div>
          )}
        </Card>
        {slots.length > 0 && (
          <>
            <div className="h-20" aria-hidden />
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
              <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-500">Total</p>
                  <p className="text-lg font-bold text-stone-900 dark:text-stone-50">
                    {formatCents(totalCents, event.currency)}
                  </p>
                </div>
                <button
                  type="button"
                  className={btnPrimary}
                  style={payBtnStyle}
                  disabled={busy}
                  onClick={() =>
                    (
                      document.getElementById("checkout-form") as HTMLFormElement | null
                    )?.requestSubmit()
                  }
                >
                  {busy ? "Placing order…" : "Place order"}
                </button>
              </div>
            </div>
          </>
        )}
        {(event.sponsorAds || []).some((a) => (a.tier || "SILVER") !== "GOLD") && (
          <SponsorsStrip
            ads={(event.sponsorAds || []).filter((a) => (a.tier || "SILVER") !== "GOLD")}
          />
        )}
        <p className="mt-6 text-center text-sm text-stone-500">
          Already ordered?{" "}
          <a href="/find-tickets" className="font-semibold underline">
            Find my tickets
          </a>
        </p>
        {showBadge && (
          <p className="mt-4 text-center text-xs text-stone-400">
            Powered by{" "}
            <a href="/" className="font-semibold underline">
              EventPass
            </a>
          </p>
        )}
      </div>
    </Container>
  );
}

export default function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense>
      <PublicEventPageInner params={params} />
    </Suspense>
  );
}
