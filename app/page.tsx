import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { Container, Card, Badge } from "@/components/ui";

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

function firstImage(imageUrls: string | null): string | null {
  if (!imageUrls) return null;
  try {
    const arr = JSON.parse(imageUrls);
    return Array.isArray(arr) && arr.length ? String(arr[0]) : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const events = await db.event.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { date: "asc" },
    include: { ticketTypes: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <Container>
      {/* Welcome hero */}
      <section className="mb-10 mt-4 text-center sm:mt-8">
        <p className="mb-3 inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
          Community ticketing
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl dark:text-stone-50">
          Where your community gathers
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-stone-500 dark:text-stone-400">
          Find upcoming events, grab your tickets in seconds, and pay the way
          you like — e-Transfer, Zelle, or cash. No accounts, no hassle.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="#events"
            className="inline-flex items-center justify-center rounded-xl bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(154,52,18,0.4)] hover:bg-orange-800 dark:bg-orange-600 dark:hover:bg-orange-500"
          >
            Browse events
          </a>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white/50 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-transparent dark:text-stone-200 dark:hover:bg-stone-800"
          >
            Host your own — it&apos;s free
          </Link>
        </div>
      </section>

      {/* Events */}
      <section id="events" className="scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          Upcoming events
        </h2>
        {events.length === 0 ? (
          <Card>
            <p className="text-stone-500 dark:text-stone-400">
              Nothing on sale right now — check back soon, new gatherings are
              added all the time.
            </p>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {events.map((e) => {
              const minPrice = e.ticketTypes.length
                ? Math.min(...e.ticketTypes.map((t) => t.priceCents))
                : null;
              const banner = firstImage(e.imageUrls);
              return (
                <Link key={e.id} href={`/e/${e.slug}`} className="group">
                  <Card className="h-full overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(120,53,15,0.12)]">
                    {banner && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={banner}
                        alt=""
                        className="h-40 w-full object-cover"
                      />
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          {e.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={e.logoUrl}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-xl border border-stone-200/70 object-contain dark:border-stone-700"
                            />
                          )}
                          <h3 className="text-lg font-semibold leading-snug text-stone-900 group-hover:text-orange-800 dark:text-stone-50 dark:group-hover:text-orange-400">
                            {e.title}
                          </h3>
                        </div>
                        <Badge tone="ember">On sale</Badge>
                      </div>
                      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                        {fmtDate(e.date)}
                      </p>
                      {e.venue && (
                        <p className="text-sm text-stone-500 dark:text-stone-400">
                          {e.venue}
                        </p>
                      )}
                      {e.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">
                          {e.description}
                        </p>
                      )}
                      <p className="mt-3 text-sm font-semibold text-orange-800 dark:text-orange-400">
                        {minPrice !== null
                          ? `From ${formatCents(minPrice, e.currency)}`
                          : "See details"}{" "}
                        <span aria-hidden>→</span>
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <p className="mt-10 text-center text-sm text-stone-500 dark:text-stone-400">
        Already ordered?{" "}
        <Link
          href="/find-tickets"
          className="font-semibold text-orange-800 underline decoration-orange-700/40 underline-offset-2 dark:text-orange-400"
        >
          Find my tickets
        </Link>
      </p>
    </Container>
  );
}
