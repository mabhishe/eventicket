import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { ticketQrDataUrl } from "@/lib/tickets";
import { Container, Card, PageTitle, Badge } from "@/components/ui";
import { SponsorsStrip } from "@/components/sponsors-strip";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const tone: Record<string, "amber" | "green" | "red" | "zinc"> = {
  PENDING_PAYMENT: "amber",
  CONFIRMED: "green",
  CANCELLED: "red",
};

export default async function OrderPage({ params }: Ctx) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      event: { include: { sponsorAds: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } },
      items: { include: { ticketType: true, mealOption: true } },
      tickets: {
        include: { ticketType: true, mealOption: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();

  const e = order.event;
  const qrUrls =
    order.status === "CONFIRMED"
      ? await Promise.all(order.tickets.map((t) => ticketQrDataUrl(t.code)))
      : [];

  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <PageTitle
          title="Your order"
          sub={`${e.title} · ordered by ${order.buyerName}`}
          action={<Badge tone={tone[order.status]}>{order.status.replace("_", " ")}</Badge>}
        />

        <Card className="mb-6">
          <h2 className="mb-2 font-semibold">Order summary</h2>
          <div className="space-y-1 text-sm">
            {order.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {i.qty} × {i.ticketType.name}
                  {i.mealOption ? ` (${i.mealOption.name})` : ""}
                </span>
                <span>{formatCents(i.unitPriceCents * i.qty, e.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
              <span>Total</span>
              <span>{formatCents(order.totalCents, e.currency)}</span>
            </div>
          </div>
        </Card>

        {order.status === "PENDING_PAYMENT" && (
          <Card className="mb-6">
            <h2 className="mb-2 font-semibold">How to pay</h2>
            {order.payMethod === "ETRANSFER" && (
              <p className="text-sm">
                Send an <strong>Interac e-Transfer</strong> of{" "}
                <strong>{formatCents(order.totalCents, e.currency)}</strong> to{" "}
                <strong>{e.etransferEmail || "the organizer"}</strong>. Put your
                name in the message so we can match it.
              </p>
            )}
            {order.payMethod === "ZELLE" && (
              <p className="text-sm">
                Send <strong>{formatCents(order.totalCents, e.currency)}</strong>{" "}
                via <strong>Zelle</strong> to{" "}
                <strong>{e.zelleHandle || "the organizer"}</strong>. Put your
                name in the memo so we can match it.
              </p>
            )}
            {order.payMethod === "CASH" && (
              <p className="text-sm">
                Pay <strong>{formatCents(order.totalCents, e.currency)}</strong>{" "}
                in cash. {e.cashNote || "See the organizer at the event."}
              </p>
            )}
            <p className="mt-3 text-sm text-zinc-500">
              Keep this page — your tickets appear here as soon as the
              organizer confirms your payment. You can also show this page at
              the door.
            </p>
          </Card>
        )}

        {order.status === "CONFIRMED" && (
          <div className="mb-6">
            <h2 className="mb-3 font-semibold">
              Your tickets ({order.tickets.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {order.tickets.map((t, i) => (
                <Card key={t.id} className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrls[i]}
                    alt={`Ticket ${t.code}`}
                    className="mx-auto h-40 w-40"
                  />
                  <p className="mt-2 font-mono text-lg font-bold tracking-widest">
                    {t.code}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {t.ticketType.name}
                    {t.mealOption ? ` · ${t.mealOption.name}` : ""}
                  </p>
                  <Link
                    href={`/t/${t.code}`}
                    className="mt-1 inline-block text-xs underline"
                  >
                    Open ticket
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        )}

        {order.status === "CANCELLED" && (
          <Card>
            <p className="text-sm">
              This order was cancelled. If you already paid, contact the
              organizer.
            </p>
          </Card>
        )}
        <SponsorsStrip ads={e.sponsorAds || []} />
      </div>
    </Container>
  );
}
