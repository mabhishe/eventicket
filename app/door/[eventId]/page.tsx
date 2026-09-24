"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Container,
  Card,
  PageTitle,
  Badge,
  Field,
  inputCls,
  btnPrimary,
  btnSecondary,
  ErrorNote,
} from "@/components/ui";
import { formatCents } from "@/lib/money";

type TicketType = {
  id: string;
  name: string;
  priceCents: number;
  includesMeal: boolean;
  left: number;
};
type MealOption = { id: string; name: string; tag: string | null };
type DoorData = {
  event: {
    id: string;
    title: string;
    date: string;
    venue: string | null;
    currency: string;
  };
  ticketTypes: TicketType[];
  mealOptions: MealOption[];
  counts: { issued: number; checkedIn: number; foodCollected: number };
  meals: {
    name: string;
    tag: string | null;
    total: number;
    checkedIn: number;
    collected: number;
  }[];
};
type RosterPerson = {
  id: string;
  holderName: string | null;
  status: string;
  checkedInAt: string | null;
  foodCollectedAt: string | null;
  ticketType: { name: string };
  mealOption: { name: string; tag: string | null } | null;
};
type Ticket = {
  id: string;
  code: string;
  holderName: string | null;
  status: string;
  foodCollectedAt: string | null;
  ticketType: { name: string };
  mealOption: { name: string; tag: string | null } | null;
  order: { buyerName: string };
};

type Tab = "entry" | "food" | "search" | "walkin" | "meals";

function DietBadge({ tag }: { tag: string | null }) {
  if (tag === "veg")
    return (
      <span className="inline-block rounded-xl bg-green-600 px-6 py-3 text-3xl font-black tracking-wide text-white">
        VEG
      </span>
    );
  if (tag === "nonveg")
    return (
      <span className="inline-block rounded-xl bg-red-600 px-6 py-3 text-3xl font-black tracking-wide text-white">
        NON-VEG
      </span>
    );
  return (
    <span className="inline-block rounded-xl bg-zinc-400 px-6 py-3 text-3xl font-black tracking-wide text-white">
      NO MEAL
    </span>
  );
}

function RosterView({ roster }: { roster: RosterPerson[] }) {
  return (
    <div className="mt-4 border-t border-zinc-200 pt-3 text-left dark:border-zinc-700">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
        Party ({roster.length})
      </p>
      <div className="space-y-1.5">
        {roster.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 dark:bg-zinc-900/70"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {p.holderName || "Guest"}
              </p>
              <p className="text-xs opacity-70">{p.ticketType.name}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Badge tone={p.status === "CHECKED_IN" ? "green" : "zinc"}>
                {p.status === "CHECKED_IN" ? "In" : "Not in"}
              </Badge>
              {p.mealOption && (
                <Badge tone={p.foodCollectedAt ? "amber" : "zinc"}>
                  {p.foodCollectedAt ? "Fed" : "Not fed"}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function DoorConsole({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [data, setData] = useState<DoorData | null>(null);
  const [tab, setTab] = useState<Tab>("entry");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // entry scan
  const [manualCode, setManualCode] = useState("");
  const [lastScan, setLastScan] = useState<{
    ok: boolean;
    message: string;
    ticket?: Ticket | null;
    party?: { total: number; checkedIn: number } | null;
    roster?: RosterPerson[] | null;
  } | null>(null);

  // food scan
  const [foodCode, setFoodCode] = useState("");
  const [foodResult, setFoodResult] = useState<{
    ok: boolean;
    already?: boolean;
    message: string;
    ticket?: Ticket | null;
    party?: { mealsTotal: number; mealsServed: number } | null;
    roster?: RosterPerson[] | null;
  } | null>(null);

  // Live camera only works in secure contexts (https or localhost). On plain
  // http:// over the LAN, phones refuse camera access — explain and fall back
  // to typing the code.
  const [noCamera, setNoCamera] = useState(false);

  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null);
  const scanningRef = useRef(false);

  // search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Ticket[]>([]);

  // walk-in (per person)
  const [wq, setWq] = useState<Record<string, number>>({});
  const [wNames, setWNames] = useState<Record<string, string>>({});
  const [wMeals, setWMeals] = useState<Record<string, string>>({});
  const [wName, setWName] = useState("");

  useEffect(() => {
    params.then((p) => setEventId(p.eventId));
  }, [params]);

  const load = useCallback(async () => {
    if (!eventId) return;
    const res = await fetch(`/api/door/event/${eventId}`);
    const d = await res.json();
    if (res.ok) setData(d);
    else setError(d.error || "Could not load event");
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function checkIn(code: string) {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, eventId }),
    });
    const d = await res.json();
    if (!res.ok) {
      setLastScan({ ok: false, message: d.error || "Check-in failed" });
      return;
    }
    const t = d.ticket ?? null;
    setLastScan({
      ok: true,
      message:
        d.message ||
        (d.partyFull ? "Everyone is already in" : d.already ? "Already checked in" : "Checked in ✓"),
      ticket: t,
      party: d.party ?? null,
      roster: d.roster ?? null,
    });
    await load();
  }

  async function collectFood(code: string) {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, eventId }),
    });
    const d = await res.json();
    if (!res.ok) {
      setFoodResult({
        ok: false,
        message: d.error || "Could not record food",
        ticket: d.ticket ?? null,
      });
      return;
    }
    const t = d.ticket ?? null;
    setFoodResult({
      ok: true,
      already: d.already === true,
      message:
        d.message ||
        (d.partyFull
          ? "All meals already served"
          : d.already
            ? `Already collected at ${fmtTime(t?.foodCollectedAt ?? null)}`
            : "Food served ✓"),
      ticket: t,
      party: d.party ?? null,
      roster: d.roster ?? null,
    });
    await load();
  }

  /**
   * Undo the most recent scan shown on screen — the fix for "scanned twice
   * but only one entered". Works for both entry and food tabs.
   */
  async function undoLastScan() {
    const current = tab === "entry" ? lastScan : foodResult;
    const ticket = current?.ticket;
    if (!ticket) return;
    if (
      !confirm(
        tab === "entry"
          ? `Undo the entry for ${ticket.holderName || ticket.order.buyerName}?`
          : `Undo the meal served to ${ticket.holderName || ticket.order.buyerName}?`
      )
    )
      return;
    setError(null);
    const endpoint =
      tab === "entry" ? "/api/door/undo-entry" : "/api/door/undo-food";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Undo failed");
      return;
    }
    const update = {
      ok: true,
      message: d.message,
      ticket: null,
      party: d.party ?? null,
      roster: d.roster ?? null,
    };
    if (tab === "entry") setLastScan(update);
    else setFoodResult({ ...update, already: false });
    await load();
  }

  // camera scanner lifecycle for the Entry and Food tabs
  const handleScan = useRef<(code: string) => Promise<void>>(checkIn);
  handleScan.current = tab === "food" ? collectFood : checkIn;
  useEffect(() => {
    if ((tab !== "entry" && tab !== "food") || !eventId) return;
    if (
      typeof navigator !== "undefined" &&
      !navigator.mediaDevices?.getUserMedia
    ) {
      // iOS/Android browsers only allow the camera on https (or localhost).
      setNoCamera(true);
      return;
    }
    setNoCamera(false);
    let cancelled = false;
    (async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scannerRef.current = scanner;
        scanner.render(
          (text: string) => {
            if (scanningRef.current) return;
            scanningRef.current = true;
            handleScan.current(text).finally(() => {
              setTimeout(() => {
                scanningRef.current = false;
              }, 1500);
            });
          },
          () => {}
        );
      } catch {
        setError("Camera scanner unavailable — type the code manually.");
      }
    })();
    return () => {
      cancelled = true;
      scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, eventId]);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    const res = await fetch(
      `/api/door/search?eventId=${eventId}&q=${encodeURIComponent(query.trim())}`
    );
    const d = await res.json();
    setResults(res.ok ? d.tickets : []);
    if (!res.ok) setError(d.error || "Search failed");
  }

  /** Per-person correction from the search results. */
  async function undoTicket(
    kind: "entry" | "food",
    ticketId: string,
    name: string
  ) {
    if (
      !confirm(
        kind === "entry"
          ? `Undo the entry for ${name}?`
          : `Undo the meal served to ${name}?`
      )
    )
      return;
    setError(null);
    setNotice(null);
    const res = await fetch(
      kind === "entry" ? "/api/door/undo-entry" : "/api/door/undo-food",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      }
    );
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Undo failed");
      return;
    }
    setNotice(d.message);
    await search();
    await load();
  }

  // walk-in attendee slots: one per ticket
  const wSlots = useMemo(() => {
    const out: {
      key: string;
      ticketTypeId: string;
      typeName: string;
      includesMeal: boolean;
    }[] = [];
    for (const t of data?.ticketTypes || []) {
      const q = wq[t.id] || 0;
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
  }, [data, wq]);

  async function walkin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (wSlots.length === 0) {
      setError("Select at least one ticket.");
      return;
    }
    const mealsNeeded = (data?.mealOptions.length || 0) > 0;
    for (const s of wSlots) {
      if (s.includesMeal && mealsNeeded && !wMeals[s.key]) {
        setError(`Choose a meal for every ${s.typeName} guest.`);
        return;
      }
    }
    const items = wSlots.map((s) => ({
      ticketTypeId: s.ticketTypeId,
      qty: 1,
      mealOptionId: wMeals[s.key] || null,
      holderName: (wNames[s.key] || "").trim() || null,
    }));
    const res = await fetch("/api/admin/walkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        buyerName: wName || "Walk-in",
        items,
        checkIn: true,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Walk-in sale failed");
      return;
    }
    setWq({});
    setWNames({});
    setWMeals({});
    setWName("");
    setNotice(
      `Walk-in sale complete — ${d.tickets.length} ticket(s) issued and checked in.`
    );
    await load();
  }

  if (!data) {
    return (
      <Container>
        <ErrorNote message={error} />
        {!error && <p className="text-zinc-500">Loading…</p>}
      </Container>
    );
  }

  const tabs: [Tab, string][] = [
    ["entry", "Entry"],
    ["food", "Food"],
    ["search", "Search"],
    ["walkin", "Walk-in"],
    ["meals", "Meals"],
  ];

  return (
    <Container>
      <PageTitle
        title={data.event.title}
        sub={`${data.counts.checkedIn} / ${data.counts.issued} in · ${data.counts.foodCollected} fed`}
        action={
          <Link href="/door" className={btnSecondary}>
            All events
          </Link>
        }
      />

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError(null);
              setNotice(null);
              setLastScan(null);
              setFoodResult(null);
            }}
            className={
              "shrink-0 rounded-lg px-5 py-3 text-sm font-semibold " +
              (tab === t
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 dark:border-zinc-700")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}
      {notice && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {notice}
        </p>
      )}

      {tab === "entry" && (
        <div className="mx-auto max-w-md">
          <Card>
            {noCamera && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                The live camera needs a secure (https) connection — this page
                is on plain http://, so the phone blocks it. Type the code
                below instead.
              </p>
            )}
            <div id="qr-reader" className="overflow-hidden rounded-lg" />
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) {
                  checkIn(manualCode.trim());
                  setManualCode("");
                }
              }}
            >
              <input
                className={inputCls}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or type group / ticket code"
                autoCapitalize="characters"
              />
              <button className={btnPrimary}>Check in</button>
            </form>
            {lastScan && (
              <div
                className={`mt-4 rounded-lg p-4 text-center ${
                  lastScan.ok
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                <p className="text-lg font-bold">{lastScan.message}</p>
                {lastScan.ticket && (
                  <p className="mt-1 text-sm">
                    {lastScan.ticket.holderName ||
                      lastScan.ticket.order.buyerName}{" "}
                    · {lastScan.ticket.ticketType.name} · {lastScan.ticket.code}
                    {lastScan.ticket.mealOption
                      ? ` · ${lastScan.ticket.mealOption.name}`
                      : ""}
                  </p>
                )}
                {lastScan.party && (
                  <p className="mt-2 text-sm font-bold">
                    👥 {lastScan.party.checkedIn} of {lastScan.party.total} in
                  </p>
                )}
                {lastScan.ok && lastScan.ticket && (
                  <button
                    className={btnSecondary + " mt-3 text-xs"}
                    onClick={undoLastScan}
                  >
                    Undo this scan
                  </button>
                )}
                {lastScan.roster && lastScan.roster.length > 0 && (
                  <RosterView roster={lastScan.roster} />
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "food" && (
        <div className="mx-auto max-w-md">
          <Card>
            <h2 className="mb-3 text-center font-semibold">Food counter</h2>
            {noCamera && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                The live camera needs a secure (https) connection — this page
                is on plain http://, so the phone blocks it. Type the code
                below instead.
              </p>
            )}
            <div id="qr-reader" className="overflow-hidden rounded-lg" />
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (foodCode.trim()) {
                  collectFood(foodCode.trim());
                  setFoodCode("");
                }
              }}
            >
              <input
                className={inputCls}
                value={foodCode}
                onChange={(e) => setFoodCode(e.target.value)}
                placeholder="Or type group / ticket code"
                autoCapitalize="characters"
              />
              <button className={btnPrimary}>Serve</button>
            </form>
            {foodResult && (
              <div
                className={`mt-4 rounded-lg p-5 text-center ${
                  foodResult.ok
                    ? foodResult.already
                      ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                <p className="text-xl font-bold">{foodResult.message}</p>
                {foodResult.ticket && (
                  <div className="mt-3">
                    <DietBadge tag={foodResult.ticket.mealOption?.tag ?? null} />
                    <p className="mt-3 text-lg font-semibold">
                      {foodResult.ticket.mealOption?.name || "No meal included"}
                    </p>
                    <p className="mt-1 text-sm opacity-80">
                      {foodResult.ticket.holderName ||
                        foodResult.ticket.order.buyerName}{" "}
                      · {foodResult.ticket.ticketType.name}
                    </p>
                  </div>
                )}
                {foodResult.party && (
                  <p className="mt-3 text-sm font-bold">
                    🍽️ {foodResult.party.mealsServed} of{" "}
                    {foodResult.party.mealsTotal} served
                  </p>
                )}
                {foodResult.ok && foodResult.ticket && !foodResult.already && (
                  <button
                    className={btnSecondary + " mt-3 text-xs"}
                    onClick={undoLastScan}
                  >
                    Undo this scan
                  </button>
                )}
                {foodResult.roster && foodResult.roster.length > 0 && (
                  <RosterView roster={foodResult.roster} />
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "search" && (
        <div className="mx-auto max-w-xl">
          <Card>
            <form onSubmit={search} className="flex gap-2">
              <input
                className={inputCls}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, ticket code, or group code"
              />
              <button className={btnPrimary}>Search</button>
            </form>
            <div className="mt-4 space-y-2">
              {results.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {t.holderName || t.order.buyerName}{" "}
                        <span className="font-mono text-zinc-500">{t.code}</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {t.ticketType.name}
                        {t.mealOption
                          ? ` · ${t.mealOption.name}${
                              t.mealOption.tag === "veg"
                                ? " (veg)"
                                : t.mealOption.tag === "nonveg"
                                  ? " (non-veg)"
                                  : ""
                            }`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {t.status === "CHECKED_IN" ? (
                        <>
                          <Badge tone="green">In</Badge>
                          <button
                            className={btnSecondary + " px-3 py-2 text-xs"}
                            onClick={() =>
                              undoTicket(
                                "entry",
                                t.id,
                                t.holderName || t.order.buyerName
                              )
                            }
                          >
                            Undo
                          </button>
                        </>
                      ) : (
                        <button
                          className={btnPrimary + " px-3 py-2 text-xs"}
                          onClick={() => checkIn(t.code)}
                        >
                          Check in
                        </button>
                      )}
                      {t.foodCollectedAt ? (
                        <>
                          <Badge tone="amber">
                            Fed {fmtTime(t.foodCollectedAt)}
                          </Badge>
                          <button
                            className={btnSecondary + " px-3 py-2 text-xs"}
                            onClick={() =>
                              undoTicket(
                                "food",
                                t.id,
                                t.holderName || t.order.buyerName
                              )
                            }
                          >
                            Undo
                          </button>
                        </>
                      ) : (
                        t.mealOption && (
                          <button
                            className={btnSecondary + " px-3 py-2 text-xs"}
                            onClick={() => collectFood(t.code)}
                          >
                            Serve food
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {query && results.length === 0 && (
                <p className="text-sm text-zinc-500">No matching tickets.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "walkin" && (
        <div className="mx-auto max-w-xl">
          <Card>
            <h2 className="mb-1 font-semibold">Sell at the door (cash)</h2>
            <p className="mb-3 text-sm text-zinc-500">
              Add each guest&rsquo;s name and meal choice.
            </p>
            <div className="space-y-3">
              {data.ticketTypes.map((t) => {
                const q = wq[t.id] || 0;
                return (
                  <div
                    key={t.id}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-zinc-500">
                          {formatCents(t.priceCents, data.event.currency)} ·{" "}
                          {t.left} left
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Remove one ${t.name}`}
                          className="h-11 w-11 rounded-lg border border-zinc-300 text-xl dark:border-zinc-700"
                          disabled={q === 0}
                          onClick={() =>
                            setWq({ ...wq, [t.id]: Math.max(0, q - 1) })
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
                          disabled={t.left <= 0 || q >= t.left}
                          onClick={() => setWq({ ...wq, [t.id]: q + 1 })}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {wSlots.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {wSlots.map((s, i) => (
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
                          value={wNames[s.key] || ""}
                          onChange={(e) =>
                            setWNames({ ...wNames, [s.key]: e.target.value })
                          }
                          placeholder="Guest name"
                        />
                      </Field>
                      {s.includesMeal && data.mealOptions.length > 0 && (
                        <Field label="Meal choice">
                          <select
                            className={inputCls}
                            value={wMeals[s.key] || ""}
                            onChange={(e) =>
                              setWMeals({ ...wMeals, [s.key]: e.target.value })
                            }
                            required
                          >
                            <option value="">Select a meal…</option>
                            {data.mealOptions.map((m) => (
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
            )}

            <form onSubmit={walkin} className="mt-4 space-y-3">
              <Field label="Buyer name (optional)">
                <input
                  className={inputCls}
                  value={wName}
                  onChange={(e) => setWName(e.target.value)}
                  placeholder="Walk-in"
                />
              </Field>
              <button className={btnPrimary + " w-full py-3"}>
                Complete cash sale & check in
              </button>
            </form>
          </Card>
        </div>
      )}

      {tab === "meals" && (
        <div className="mx-auto max-w-xl">
          <Card>
            <h2 className="mb-3 font-semibold">Meal counts (for the kitchen)</h2>
            {data.meals.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No meal options for this event.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="py-2 pr-2">Meal</th>
                      <th className="py-2 pr-2 text-right">Ordered</th>
                      <th className="py-2 pr-2 text-right">Served</th>
                      <th className="py-2 text-right">Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meals.map((m) => (
                      <tr
                        key={m.name}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="py-2 pr-2 font-medium">
                          {m.name}
                          {m.tag === "veg" && (
                            <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-900 dark:text-green-200">
                              VEG
                            </span>
                          )}
                          {m.tag === "nonveg" && (
                            <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-900 dark:text-red-200">
                              NON-VEG
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right">{m.total}</td>
                        <td className="py-2 pr-2 text-right">{m.collected}</td>
                        <td className="py-2 text-right font-bold">
                          {m.total - m.collected}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </Container>
  );
}
