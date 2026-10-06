import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { Container, Card, Badge } from "@/components/ui";
import { publicSignupEnabled } from "@/lib/publicSignup";
import { formatEventWhen, isUpcomingEvent } from "@/lib/datetime";
import { ResponsiveImage } from "@/components/responsive-image";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Find community events and pay the organizer directly — e-Transfer and more. No accounts, no hassle.",
  openGraph: {
    title: "EventPass",
    description:
      "Find community events and pay the organizer directly — e-Transfer and more.",
    url: "/",
    siteName: "EventPass",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "EventPass",
    description:
      "Find community events and pay the organizer directly — e-Transfer and more.",
  },
};

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true as const,
};

const organizerFeatures = [
  {
    title: "One page, sell passes",
    body: "Publish an event page and sell passes without building a site.",
    icon: (
      <svg {...iconProps}>
        <path
          d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M14 3.5V8h5M8.5 12.5h7M8.5 16h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Paid to you directly",
    body: "Guests pay you by e-Transfer or the methods you turn on.",
    icon: (
      <svg {...iconProps}>
        <rect
          x="3"
          y="6"
          width="18"
          height="12"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M3 10h18M7 14.5h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Phone check-in",
    body: "Scan tickets at the door with any phone.",
    icon: (
      <svg {...iconProps}>
        <rect
          x="7"
          y="2.5"
          width="10"
          height="19"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M10.5 17.5h3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M9.5 11.5 11.2 13.2 14.8 9.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

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
          Find upcoming events, grab your passes in seconds, and pay the
          organizer directly (e-Transfer and more). No accounts, no hassle.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="#events"
            className="inline-flex items-center justify-center rounded-xl bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(154,52,18,0.4)] hover:bg-orange-800 dark:bg-orange-600 dark:hover:bg-orange-500"
          >
            Browse events
          </a>
          {publicSignupEnabled() && (
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white/50 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-transparent dark:text-stone-200 dark:hover:bg-stone-800"
            >
              Host your own — it&apos;s free
            </Link>
          )}
        </div>
      </section>

      {/* Events */}
      <section id="events" className="scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          Upcoming events
        </h2>
        {events.filter((e) => isUpcomingEvent(e.date)).length === 0 ? (
          <Card>
            <p className="font-medium text-stone-800 dark:text-stone-100">
              No upcoming events
            </p>
            <p className="mt-1 text-stone-500 dark:text-stone-400">
              Nothing on sale right now — check back soon, new gatherings are
              added all the time.
            </p>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {events.filter((e) => isUpcomingEvent(e.date)).map((e, index) => {
              const minPrice = e.ticketTypes.length
                ? Math.min(...e.ticketTypes.map((t) => t.priceCents))
                : null;
              const banner = firstImage(e.imageUrls);
              return (
                <Link key={e.id} href={`/e/${e.slug}`} className="group">
                  <Card className="h-full overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(120,53,15,0.12)]">
                    <div className="relative aspect-[5/2] w-full overflow-hidden bg-stone-200 dark:bg-stone-800">
                      {banner ? (
                        <ResponsiveImage
                          src={banner}
                          alt=""
                          sizes="(min-width: 640px) 480px, 100vw"
                          priority={index === 0}
                          className="absolute inset-0 h-full w-full object-cover"
                          width={1600}
                          height={640}
                        />
                      ) : null}
                    </div>
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
                        {formatEventWhen(e.date, e.timezone)}
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

      <section className="mt-5">
        <Card className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            Run your event on EventPass
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-stone-600 dark:text-stone-300">
            A public page, payment to you, and check-in from a phone.
          </p>
          <ul className="mt-5 grid gap-3 text-left md:grid-cols-3">
            {organizerFeatures.map((feature) => (
              <li
                key={feature.title}
                className="flex h-full flex-col rounded-xl border border-stone-200/80 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950"
              >
                <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                  {feature.icon}
                </span>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                  {feature.title}
                </p>
                <p className="mt-1 text-sm leading-snug text-stone-600 dark:text-stone-300">
                  {feature.body}
                </p>
              </li>
            ))}
          </ul>
          <Link
            href="/pricing"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 dark:bg-orange-600 dark:hover:bg-orange-500"
          >
            See pricing
          </Link>
        </Card>
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
