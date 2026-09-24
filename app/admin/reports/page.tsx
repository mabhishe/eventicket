"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Container,
  Card,
  PageTitle,
  inputCls,
  ErrorNote,
} from "@/components/ui";
import { formatCents } from "@/lib/money";

type Report = {
  summary: {
    orders: number;
    revenueCents: number;
    ticketsIssued: number;
    ticketsCheckedIn: number;
    foodCollected: number;
  };
  byTicketType: { name: string; qty: number; revenueCents: number }[];
  bySeller: { name: string; orders: number; revenueCents: number }[];
  meals: {
    name: string;
    tag: string | null;
    total: number;
    checkedIn: number;
    collected: number;
    remaining: number;
  }[];
};
type EventOpt = { id: string; title: string };

export default function ReportsPage() {
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((d) => {
        if (d.events) {
          setEvents(d.events);
          if (d.events.length > 0) setEventId(d.events[0].id);
        }
      });
  }, []);

  const load = useCallback(async () => {
    const q = eventId ? `?eventId=${eventId}` : "";
    const res = await fetch(`/api/admin/reports${q}`);
    const data = await res.json();
    if (res.ok) setReport(data);
    else setError(data.error || "Could not load report");
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const s = report?.summary;

  return (
    <Container>
      <PageTitle
        title="Reports"
        sub="Confirmed orders only."
        action={
          <select
            className={inputCls + " w-auto"}
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        }
      />
      <ErrorNote message={error} />
      {s && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Revenue", formatCents(s.revenueCents)],
              ["Orders", String(s.orders)],
              ["Tickets issued", String(s.ticketsIssued)],
              ["Checked in", String(s.ticketsCheckedIn)],
              ["Food collected", String(s.foodCollected)],
            ].map(([label, value]) => (
              <Card key={label}>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {label}
                </p>
                <p className="text-2xl font-bold">{value}</p>
              </Card>
            ))}
          </div>

          {eventId && (
            <div className="mb-6">
              <a
                className="inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
                href={`/api/admin/reports/guest-list?eventId=${eventId}`}
              >
                Download guest list (CSV)
              </a>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold">By ticket type</h2>
              {report!.byTicketType.length === 0 ? (
                <p className="text-sm text-zinc-500">No sales yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {report!.byTicketType.map((r) => (
                      <tr
                        key={r.name}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        <td className="py-2">{r.name}</td>
                        <td className="py-2 text-right text-zinc-500">
                          {r.qty} sold
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {formatCents(r.revenueCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold">By seller</h2>
              {report!.bySeller.length === 0 ? (
                <p className="text-sm text-zinc-500">No sales yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {report!.bySeller.map((r) => (
                      <tr
                        key={r.name}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        <td className="py-2">{r.name}</td>
                        <td className="py-2 text-right text-zinc-500">
                          {r.orders} orders
                        </td>
                        <td className="py-2 text-right font-semibold">
                          {formatCents(r.revenueCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <Card className="mt-6">
            <h2 className="mb-3 font-semibold">Meal counts</h2>
            {report!.meals.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No meal choices on confirmed tickets.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="py-2 pr-2">Meal</th>
                      <th className="py-2 pr-2 text-right">Ordered</th>
                      <th className="py-2 pr-2 text-right">Served</th>
                      <th className="py-2 text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report!.meals.map((m) => (
                      <tr
                        key={m.name}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="py-2 pr-2">
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
                          {m.remaining}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </Container>
  );
}
