import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { Container, Card, PageTitle, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function Home() {
  const events = await db.event.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { date: "asc" },
    include: { ticketTypes: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <Container>
      <PageTitle
        title="Upcoming events"
        sub="Pick an event, choose your tickets, and pay with e-Transfer, Zelle, or cash."
      />
      {events.length === 0 ? (
        <Card>
          <p className="text-zinc-500">
            No events on sale right now. Check back soon.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => {
            const minPrice = e.ticketTypes.length
              ? Math.min(...e.ticketTypes.map((t) => t.priceCents))
              : null;
            return (
              <Link key={e.id} href={`/e/${e.slug}`}>
                <Card className="h-full transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      {e.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.logoUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded object-contain"
                        />
                      )}
                      <h2 className="text-lg font-semibold">{e.title}</h2>
                    </div>
                    <Badge tone="green">On sale</Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{fmtDate(e.date)}</p>
                  {e.venue && (
                    <p className="text-sm text-zinc-500">{e.venue}</p>
                  )}
                  {e.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {e.description}
                    </p>
                  )}
                  <p className="mt-3 text-sm font-semibold">
                    {minPrice !== null
                      ? `From ${formatCents(minPrice, e.currency)}`
                      : "See details"}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <p className="mt-8 text-center text-sm text-zinc-500">
        Already ordered?{" "}
        <Link href="/find-tickets" className="font-semibold underline">
          Find my tickets
        </Link>
      </p>
    </Container>
  );
}
