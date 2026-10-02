import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { ticketQrDataUrl } from "@/lib/tickets";
import { ensureOrderRefCode, ensureOrderInviteCode } from "@/lib/orders";
import { Container, Card, PageTitle, Badge, btnPrimary } from "@/components/ui";
import { SponsorsStrip } from "@/components/sponsors-strip";
import { ShareButton } from "@/components/ShareButton";
import { InviteCard } from "@/components/invite-card";
import { PendingOrderActions } from "@/components/PendingOrderActions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const tone: Record<string, "amber" | "green" | "red" | "stone"> = {
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
    order.tickets.length > 0 ? await ensureOrderRefCode(order.id) : order.refCode;
  const personalPasses = await Promise.all(
    order.tickets.map(async (t) => ({
      ticket: t,
      qr: await ticketQrDataUrl(t.code),
    }))
  );
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
            <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold dark:border-stone-800">
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
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Your payment code
                </p>
                <p className="font-mono text-3xl font-bold tracking-[0.25em]">
                  {order.refCode}
                </p>
                <p className="mt-1 text-xs text-stone-500">
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
            <p className="mt-3 text-sm text-stone-500">
              Send the full amount. A short transfer stays pending until the
              rest arrives, and each person&apos;s QR appears here once the
              order is confirmed.
            </p>
          </Card>
        )}

        {personalPasses.length > 0 && (
          <div className="mb-6">
            {order.status === "PENDING_PAYMENT" && (
              <Card className="mb-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
                <p className="text-sm">
                  You are admitted while payment is still outstanding. Each
                  person can use the QR below. The balance on this order is
                  still due.
                </p>
              </Card>
            )}
            <h2 className="mb-3 font-semibold">
              Each person&apos;s pass ({personalPasses.length})
            </h2>
            <div className="space-y-4">
              {personalPasses.map(({ ticket: t, qr }) => (
                <Card key={t.id} className="text-center">
                  <p className="text-lg font-semibold">
                    {t.holderName || order.buyerName}
                  </p>
                  <p className="text-sm text-stone-500">
                    {t.ticketType.name}
                    {t.mealOption ? ` · ${t.mealOption.name}` : ""}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr}
                    alt={`QR for ${t.holderName || order.buyerName}`}
                    className="mx-auto mt-3 h-56 w-56"
                  />
                  <p className="mt-3 font-mono text-2xl font-bold tracking-[0.2em]">
                    {t.code}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500">
                    Only {t.holderName || order.buyerName} shows this QR, at
                    the door and at the food line.
                  </p>
                  <div className="mt-3 flex justify-center">
                    <ShareButton
                      url={`/t/${t.code}`}
                      title={`${e.title} — ${t.holderName || order.buyerName}`}
                      text={`Ticket for ${t.holderName || order.buyerName}`}
                    />
                  </div>
                </Card>
              ))}
            </div>
            {groupCode && (
              <p className="mt-4 text-center text-xs text-stone-500">
                Family lookup code{" "}
                <span className="font-mono font-bold tracking-widest">
                  {groupCode}
                </span>
                . If someone arrives without their own QR, staff can search
                this and pick their name.
              </p>
            )}
            <Card className="mt-6 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Need more tickets?</h2>
                  <p className="text-sm text-stone-500">
                    Paid orders are locked. Buying more starts a new order
                    with its own payment code. Your details are filled in.
                  </p>
                </div>
                <Link href={buyMoreUrl} className={btnPrimary}>
                  Buy more tickets
                </Link>
              </div>
            </Card>
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
