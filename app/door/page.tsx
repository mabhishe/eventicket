import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Container, Card, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function DoorPicker() {
  await requireUser(["ADMIN", "DOOR"]);

  const events = await db.event.findMany({
    where: { status: { in: ["PUBLISHED", "CLOSED"] } },
    orderBy: { date: "desc" },
    take: 20,
    include: {
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  const counts = await Promise.all(
    events.map(async (e) => {
      const [issued, checkedIn] = await Promise.all([
        db.ticket.count({
          where: { order: { eventId: e.id, status: "CONFIRMED" } },
        }),
        db.ticket.count({
          where: {
            order: { eventId: e.id, status: "CONFIRMED" },
            status: "CHECKED_IN",
          },
        }),
      ]);
      return { id: e.id, issued, checkedIn };
    })
  );
  const countById = new Map(counts.map((c) => [c.id, c]));

  return (
    <Container>
      <PageTitle
        title="Door check-in"
        sub="Pick the event you're working, then scan tickets."
      />
      {events.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">
            No published events. Ask an organizer to publish one first.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => {
            const c = countById.get(e.id);
            return (
              <Link key={e.id} href={`/door/${e.id}`}>
                <Card className="h-full transition hover:shadow-md">
                  <h2 className="font-semibold">{e.title}</h2>
                  <p className="text-sm text-zinc-500">{fmtDate(e.date)}</p>
                  <p className="mt-2 text-sm">
                    {c?.checkedIn ?? 0} / {c?.issued ?? 0} checked in
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </Container>
  );
}
