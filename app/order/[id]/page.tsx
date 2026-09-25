import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { orderQrDataUrl } from "@/lib/tickets";
import { ensureOrderRefCode, ensureOrderInviteCode } from "@/lib/orders";
import { Container, Card, PageTitle, Badge, btnPrimary } from "@/components/ui";
import { SponsorsStrip } from "@/components/sponsors-strip";
import { ShareButton } from "@/components/ShareButton";
import { InviteCard } from "@/components/invite-card";
import { PendingOrderActions } from "@/components/PendingOrderActions";

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
      event: {
        include: {
          sponsorAds: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
      items: { include: { ticketType: true, mealOption: true } },
      tickets: {
        include: { ticketType: true, mealOption: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();

  const e = order.event;
  // One group pass per order: the refCode admits the whole party, one scan
  // per person at the door and one per meal at the food line.
  const groupCode =
    order.status === "CONFIRMED" ? await ensureOrderRefCode(order.id) : null;
  const groupQr = groupCode ? await orderQrDataUrl(groupCode) : null;
  const inviteCode = await ensureOrderInviteCode(order.id);
  const friendCount = await db.order.count({
    where: { eventId: e.id, invitedBy: inviteCode },
  });
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(e.date));
  let bannerUrl: string | null = null;
  try {
    const g = JSON.parse(e.imageUrls || "[]");
    if (Array.isArray(g)) bannerUrl = g.find((x) => typeof x === "string") || null;
  } catch {
    bannerUrl = null;
  }

  // "Buy more tickets" starts a fresh order with the buyer's details filled in.
  const buyMoreUrl =
    `/e/${e.slug}` +
    `?name=${encodeURIComponent(order.buyerName)}` +
    (order.buyerEmail
      ? `&email=${encodeURIComponent(order.buyerEmail)}`
      : "") +
    (order.buyerPhone
      ? `&phone=${encodeURIComponent(order.buyerPhone)}`
      : "");

  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <PageTitle
          title="Your order"
          sub={`${e.title} · ordered by ${order.buyerName}`}
          action={
            <div className="flex items-center gap-2">
              <ShareButton
                url={`/order/${order.id}`}
                title={`${e.title} — order`}
              />
              <Badge tone={tone[order.status]}>
                {order.status.replace("_", " ")}
              </Badge>
            </div>
          }
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
          <PendingOrderActions
            orderId={order.id}
            eventSlug={e.slug}
            buyerName={order.buyerName}
            buyerEmail={order.buyerEmail}
            buyerPhone={order.buyerPhone}
            items={order.items}
          />
        )}
        {order.status === "PENDING_PAYMENT" && (
          <Card className="mb-6">
            <h2 className="mb-2 font-semibold">How to pay</h2>
            {order.refCode && order.payMethod !== "CASH" && (
              <div className="mb-3 rounded-xl bg-amber-500/10 p-4 text-center dark:bg-amber-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Your payment code
                </p>
                <p className="font-mono text-3xl font-bold tracking-[0.25em]">
                  {order.refCode}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Put this code in your transfer message so we can match your
                  payment instantly.
                </p>
              </div>
            )}
            {order.payMethod === "ETRANSFER" && (
              <p className="text-sm">
                Send an <strong>Interac e-Transfer</strong> of{" "}
                <strong>{formatCents(order.totalCents, e.currency)}</strong> to{" "}
                <strong>{e.etransferEmail || "the organizer"}</strong>.
                {order.refCode ? (
                  <>
                    {" "}
                    Put the code <strong>{order.refCode}</strong> in the message.
                  </>
                ) : (
                  " Put your name in the message so we can match it."
                )}
              </p>
            )}
            {order.payMethod === "ZELLE" && (
              <p className="text-sm">
                Send <strong>{formatCents(order.totalCents, e.currency)}</strong>{" "}
                via <strong>Zelle</strong> to{" "}
                <strong>{e.zelleHandle || "the organizer"}</strong>.
                {order.refCode ? (
                  <>
                    {" "}
                    Put the code <strong>{order.refCode}</strong> in the memo.
                  </>
                ) : (
                  " Put your name in the memo so we can match it."
                )}
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

        {order.status === "CONFIRMED" && groupCode && groupQr && (
          <div className="mb-6">
            <Card className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Entry + food pass
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={groupQr}
                alt={`Group pass ${groupCode}`}
                className="mx-auto mt-3 h-56 w-56"
              />
              <p className="mt-3 font-mono text-3xl font-bold tracking-[0.25em]">
                {groupCode}
              </p>
              <p className="mt-2 text-sm font-medium">
                {order.tickets.length}{" "}
                {order.tickets.length === 1 ? "person" : "people"} · one code
                for your whole group
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
                Show this at the door and at the food line — we scan it once
                per person. After everyone is in, it stops working.
              </p>
              <div className="mt-4 flex justify-center">
                <ShareButton
                  url={`/order/${order.id}`}
                  title={`${e.title} — group pass`}
                  text={`My group pass for ${e.title}`}
                />
              </div>
            </Card>
            <Card className="mt-6 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Need more tickets?</h2>
                  <p className="text-sm text-zinc-500">
                    Paid orders are locked — buying more starts a new order
                    with its own payment code and group pass. Your details are
                    filled in for you.
                  </p>
                </div>
                <Link href={buyMoreUrl} className={btnPrimary}>
                  Buy more tickets
                </Link>
              </div>
            </Card>
            <h2 className="mb-3 mt-6 font-semibold">
              Who&apos;s coming ({order.tickets.length})
            </h2>
            <div className="space-y-2">
              {order.tickets.map((t) => (
                <Card key={t.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {t.holderName || order.buyerName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {t.ticketType.name}
                      {t.mealOption ? ` · ${t.mealOption.name}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/t/${t.code}`}
                    className="text-xs underline"
                  >
                    Ticket
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
        {order.status !== "CANCELLED" && (
          <div className="mt-4">
            <InviteCard
              eventTitle={e.title}
              eventSlug={e.slug}
              inviteCode={inviteCode}
              friendCount={friendCount}
              eventDateLabel={dateLabel}
              bannerUrl={bannerUrl}
              logoUrl={e.logoUrl}
            />
          </div>
        )}
        <SponsorsStrip ads={e.sponsorAds || []} />
      </div>
    </Container>
  );
}
