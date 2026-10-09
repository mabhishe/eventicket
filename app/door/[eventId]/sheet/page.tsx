import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgUser } from "@/lib/auth";
import { Container, PageTitle, btnSecondary } from "@/components/ui";
import PrintButton from "@/components/print-button";
import { eventTimeZone, formatEventWhen } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/**
 * Printable door sheet — the offline backup plan.
 * Print this before the event: if scanners, phones, or the internet fail at
 * the venue, door staff check people in with pen on paper (entry + food
 * columns), then reconcile in the app afterwards.
 */
export default async function DoorSheetPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { orgId } = await requireOrgUser(["ORG_OWNER", "ORG_ADMIN", "ORG_DOOR"]);

  const event = await db.event.findFirst({
    where: { id: eventId, organizationId: orgId },
  });
  if (!event) {
    return (
      <Container>
        <p className="text-sm text-stone-500">Event not found.</p>
      </Container>
    );
  }

  const orders = await db.order.findMany({
    where: {
      eventId,
      OR: [{ status: "CONFIRMED" }, { emergencyAdmittedAt: { not: null } }],
    },
    orderBy: { buyerName: "asc" },
    include: {
      items: { include: { ticketType: { select: { name: true } } } },
      tickets: {
        include: { mealOption: { select: { name: true, tag: true } } },
      },
    },
  });

  const totalTickets = orders.reduce(
    (s, o) => s + o.items.reduce((a, i) => a + i.qty, 0),
    0
  );
  const vegCount = orders.reduce(
    (s, o) => s + o.tickets.filter((t) => t.mealOption?.tag === "veg").length,
    0
  );
  const nonVegCount = orders.reduce(
    (s, o) => s + o.tickets.filter((t) => t.mealOption?.tag === "nonveg").length,
    0
  );
  const generatedAt = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: eventTimeZone(event.timezone),
  }).format(new Date());

  return (
    <Container>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-sheet, .print-sheet * { visibility: visible; }
          .print-sheet { position: absolute; inset: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print">
        <PageTitle
          title="Door sheet"
          sub="Print this before the event — the paper backup if scanning or the internet fails."
          action={
            <div className="flex gap-2">
              <PrintButton />
              <Link href={`/door/${eventId}`} className={btnSecondary}>
                Back to check-in
              </Link>
            </div>
          }
        />
      </div>

      <div className="print-sheet rounded-2xl border border-stone-200 bg-white p-6 text-stone-900">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{event.title} — Door sheet</h1>
            <p className="text-sm text-stone-500">
              {formatEventWhen(event.date, event.timezone)}
            </p>
            <p className="text-sm text-stone-500">
              Generated {generatedAt} · {orders.length} groups · {totalTickets}{" "}
              tickets
              {vegCount + nonVegCount > 0 &&
                ` · ${vegCount} veg / ${nonVegCount} non-veg meals`}
            </p>
          </div>
        </div>
        <p className="mb-4 text-xs text-stone-500">
          One row per person. Tick ☐ In and ☐ Food, then reconcile in the app
          by searching the ticket code. The family code is only a lookup.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-stone-300 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Person</th>
              <th className="py-2 pr-2">Ticket code</th>
              <th className="py-2 pr-2">Family code</th>
              <th className="py-2 pr-2">Meal</th>
              <th className="py-2 pr-2">Medical / allergy</th>
              <th className="py-2 pr-2 text-center">In</th>
              <th className="py-2 text-center">Food</th>
            </tr>
          </thead>
          <tbody>
            {orders.flatMap((o) =>
              o.tickets
                .filter((t) => t.status !== "CANCELLED")
                .map((t) => ({ order: o, ticket: t }))
            ).map((row, i) => (
              <tr key={row.ticket.id} className="border-b border-stone-100">
                <td className="py-2 pr-2 text-stone-400">{i + 1}</td>
                <td className="py-2 pr-2">
                  <span className="font-semibold">
                    {row.ticket.holderName || row.order.buyerName}
                  </span>
                  <span className="block text-xs text-stone-500">
                    {row.order.buyerName}
                    {row.order.status !== "CONFIRMED" ? " · unpaid" : ""}
                  </span>
                  {row.order.emergencyName && (
                    <span className="block text-xs font-medium text-red-700">
                      🚨 {row.order.emergencyName}
                      {row.order.emergencyPhone
                        ? ` · ${row.order.emergencyPhone}`
                        : ""}
                      {row.order.emergencyRelation
                        ? ` (${row.order.emergencyRelation})`
                        : ""}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-2 font-mono text-xs font-bold tracking-widest">
                  {row.ticket.code}
                </td>
                <td className="py-2 pr-2 font-mono text-xs tracking-widest">
                  {row.order.refCode || "—"}
                </td>
                <td className="py-2 pr-2 text-xs">
                  {row.ticket.mealOption?.name || "—"}
                </td>
                <td className="py-2 pr-2 text-xs">
                  {row.ticket.medicalNotes ? (
                    <span className="font-medium text-amber-800">
                      ⚕️ {row.ticket.medicalNotes}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-2 text-center">
                  <span className="inline-block h-5 w-5 rounded border-2 border-stone-400" />
                </td>
                <td className="py-2 text-center">
                  <span className="inline-block h-5 w-5 rounded border-2 border-stone-400" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="py-6 text-center text-sm text-stone-500">
            No confirmed orders yet.
          </p>
        )}
      </div>
    </Container>
  );
}
