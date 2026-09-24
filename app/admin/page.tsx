import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import {
  Container,
  Card,
  PageTitle,
  Badge,
  btnPrimary,
  btnSecondary,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const statusTone: Record<string, "zinc" | "green" | "amber" | "red" | "blue"> =
  {
    DRAFT: "zinc",
    PUBLISHED: "green",
    CLOSED: "amber",
    PENDING_PAYMENT: "amber",
    CONFIRMED: "green",
    CANCELLED: "red",
  };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminDashboard() {
  const user = await requireUser(["ADMIN", "SELLER"]);

  const events = await db.event.findMany({
    orderBy: { date: "desc" },
    include: {
      ticketTypes: true,
      _count: { select: { orders: true } },
    },
  });

  const pendingOrders = await db.order.findMany({
    where: { status: "PENDING_PAYMENT" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      event: { select: { title: true } },
      items: { include: { ticketType: true } },
    },
  });

  return (
    <Container>
      <PageTitle
        title={`Welcome, ${user.name}`}
        sub="Create events, confirm payments, and issue tickets."
        action={
          <div className="flex gap-2">
            {user.role === "ADMIN" && (
              <Link href="/admin/events/new" className={btnPrimary}>
                New event
              </Link>
            )}
            <Link href="/admin/orders" className={btnSecondary}>
              All orders
            </Link>
          </div>
        }
      />

      <h2 className="mb-3 text-lg font-semibold">Events</h2>
      {events.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">
            No events yet.{" "}
            {user.role === "ADMIN" && (
              <Link href="/admin/events/new" className="underline">
                Create your first event
              </Link>
            )}
          </p>
        </Card>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{e.title}</h3>
                  <p className="text-sm text-zinc-500">{fmtDate(e.date)}</p>
                </div>
                <Badge tone={statusTone[e.status]}>{e.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {e.ticketTypes.length} ticket types · {e._count.orders} orders
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/admin/events/${e.id}`}
                  className={btnSecondary + " text-xs"}
                >
                  Manage
                </Link>
                {e.status === "PUBLISHED" && (
                  <Link
                    href={`/e/${e.slug}`}
                    className={btnSecondary + " text-xs"}
                  >
                    Public page
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">
        Orders waiting for payment ({pendingOrders.length})
      </h2>
      {pendingOrders.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">Nothing waiting. Nice.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingOrders.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{o.buyerName}</p>
                  <p className="text-sm text-zinc-500">
                    {o.event.title} ·{" "}
                    {o.items
                      .map((i) => `${i.qty} × ${i.ticketType.name}`)
                      .join(", ")}{" "}
                    · {o.payMethod}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {fmtDate(o.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    {formatCents(o.totalCents)}
                  </span>
                  <Link
                    href={`/admin/orders?highlight=${o.id}`}
                    className={btnPrimary + " text-xs"}
                  >
                    Review
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}
