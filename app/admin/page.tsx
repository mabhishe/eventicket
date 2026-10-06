import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgUser } from "@/lib/auth";
import { formatCents, summarizePayments } from "@/lib/money";
import ResendVerificationButton from "./ResendVerificationButton";
import {
  Container,
  Card,
  PageTitle,
  Badge,
  btnPrimary,
  btnSecondary,
} from "@/components/ui";
import { CloneEventButton } from "@/components/clone-event-button";

export const dynamic = "force-dynamic";

const statusTone: Record<string, "stone" | "green" | "amber" | "red" | "blue"> =
  {
    DRAFT: "stone",
    PUBLISHED: "green",
    CLOSED: "amber",
    PENDING_PAYMENT: "amber",
    CONFIRMED: "green",
    CANCELLED: "red",
  };

function fmtDate(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-50">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
    </Card>
  );
}

export default async function AdminDashboard() {
  const { user, orgId, orgRole } = await requireOrgUser([
    "ORG_OWNER",
    "ORG_ADMIN",
    "ORG_STAFF",
  ]);
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  const timeZone = org?.timezone || "America/Toronto";
  const canManage = orgRole === "ORG_OWNER" || orgRole === "ORG_ADMIN";
  const now = new Date();

  const [events, moneyOrders, pendingOrders] = await Promise.all([
    db.event.findMany({
      where: { organizationId: orgId },
      orderBy: { date: "asc" },
      include: {
        ticketTypes: true,
        _count: { select: { orders: true } },
      },
    }),
    db.order.findMany({
      where: {
        status: { not: "CANCELLED" },
        event: { organizationId: orgId },
      },
      select: {
        status: true,
        totalCents: true,
        payments: { select: { kind: true, amountCents: true } },
      },
    }),
    db.order.findMany({
      where: { status: "PENDING_PAYMENT", event: { organizationId: orgId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        event: { select: { title: true } },
        items: { include: { ticketType: true } },
      },
    }),
  ]);

  let collectedCents = 0;
  let outstandingCents = 0;
  let confirmedCount = 0;
  let pendingCount = 0;
  for (const o of moneyOrders) {
    const sum = summarizePayments(o.payments, o.totalCents);
    const legacy = o.payments.length === 0 && o.status === "CONFIRMED";
    collectedCents += legacy ? o.totalCents : sum.net;
    if (o.status === "CONFIRMED") confirmedCount += 1;
    if (o.status === "PENDING_PAYMENT") {
      pendingCount += 1;
      outstandingCents += Math.max(0, o.totalCents - sum.net - sum.waived);
    }
  }

  const upcoming = events.filter((e) => e.date >= now);
  const past = events.filter((e) => e.date < now).reverse();

  const eventCard = (e: (typeof events)[number]) => (
    <Card key={e.id}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{e.title}</h3>
          <p className="text-sm text-stone-500">{fmtDate(e.date, e.timezone || timeZone)}</p>
        </div>
        <Badge tone={statusTone[e.status]}>{e.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-stone-500">
        {e.ticketTypes.length} ticket types · {e._count.orders} orders
      </p>
      <div className="mt-3 flex gap-2">
        <Link href={`/admin/events/${e.id}`} className={btnSecondary + " text-xs"}>
          Manage
        </Link>
        {canManage && <CloneEventButton eventId={e.id} className="text-xs" />}
        {e.status === "PUBLISHED" && (
          <Link href={`/e/${e.slug}`} className={btnSecondary + " text-xs"}>
            Public page
          </Link>
        )}
      </div>
    </Card>
  );

  return (
    <Container>
      {!user.emailVerified && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>Verify your email</strong> to publish events — check your
          inbox for the verification link we sent to {user.email}.
          <ResendVerificationButton />
        </div>
      )}
      <PageTitle
        title={`Welcome, ${user.name}`}
        sub="Create events, confirm payments, and issue tickets."
        action={
          <div className="flex gap-2">
            {canManage && (
              <Link href="/admin/events/new" className={btnPrimary}>
                New event
              </Link>
            )}
            <Link href="/admin/orders" className={btnSecondary}>
              All orders
            </Link>
            {canManage && (
              <Link href="/admin/users" className={btnSecondary}>
                Team
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Upcoming events" value={String(upcoming.length)} />
        <Stat
          label="Confirmed orders"
          value={String(confirmedCount)}
          sub="across all events"
        />
        <Stat label="Money collected" value={formatCents(collectedCents)} />
        <Stat
          label="Still owing"
          value={formatCents(outstandingCents)}
          sub={
            pendingCount > 0
              ? `${pendingCount} unpaid order${pendingCount === 1 ? "" : "s"}`
              : "all clear"
          }
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Upcoming events</h2>
      {upcoming.length === 0 ? (
        <Card className="mb-8">
          <p className="text-sm text-stone-500">
            No upcoming events.{" "}
            {canManage && (
              <Link href="/admin/events/new" className="underline">
                Create one
              </Link>
            )}
          </p>
        </Card>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">{upcoming.map(eventCard)}</div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-stone-500">Past events</h2>
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            {past.map(eventCard)}
          </div>
        </>
      )}

      <h2 className="mb-3 text-lg font-semibold">
        Orders waiting for payment ({pendingCount})
      </h2>
      {pendingOrders.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-500">Nothing waiting. Nice.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingOrders.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{o.buyerName}</p>
                  <p className="text-sm text-stone-500">
                    {o.event.title} ·{" "}
                    {o.items
                      .map((i) => `${i.qty} × ${i.ticketType.name}`)
                      .join(", ")}{" "}
                    · {o.payMethod}
                  </p>
                  <p className="text-xs text-stone-400">
                    {fmtDate(o.createdAt, timeZone)}
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
