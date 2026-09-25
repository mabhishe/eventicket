import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { orderQrDataUrl } from "@/lib/tickets";
import { ensureOrderRefCode, ensureOrderInviteCode } from "@/lib/orders";
import { Container, Card, Badge } from "@/components/ui";
import { SponsorsStrip } from "@/components/sponsors-strip";
import { ShareButton } from "@/components/ShareButton";
import { InviteCard } from "@/components/invite-card";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export default async function TicketPage({ params }: Ctx) {
  const { code } = await params;
  const ticket = await db.ticket.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      ticketType: true,
      mealOption: true,
      order: { include: { event: { include: { sponsorAds: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } } } },
    },
  });
  if (!ticket) notFound();

  const e = ticket.order.event;
  // The group pass: one code for the whole order, scanned once per person.
  const groupCode = await ensureOrderRefCode(ticket.order.id);
  const inviteCode = await ensureOrderInviteCode(ticket.order.id);
  const friendCount = await db.order.count({
    where: { eventId: e.id, invitedBy: inviteCode },
  });
  const partySize = await db.ticket.count({
    where: { orderId: ticket.order.id, status: { not: "CANCELLED" } },
  });
  const qr = await orderQrDataUrl(groupCode);
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(e.date));

  return (
    <Container>
      <div className="mx-auto max-w-sm">
        <Card className="text-center">
          <p className="text-sm text-zinc-500">{e.title}</p>
          <h1 className="mt-1 text-xl font-bold">{ticket.ticketType.name}</h1>
          <p className="text-sm text-zinc-500">
            {new Intl.DateTimeFormat("en-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(e.date)}
            {e.venue ? ` · ${e.venue}` : ""}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`Group pass ${groupCode}`}
            className="mx-auto mt-4 h-56 w-56"
          />
          <p className="mt-3 font-mono text-2xl font-bold tracking-widest">
            {groupCode}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Group pass · {partySize} {partySize === 1 ? "person" : "people"} ·
            scanned once per person at the door and food line
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge
              tone={
                ticket.status === "CHECKED_IN"
                  ? "green"
                  : ticket.status === "CANCELLED"
                    ? "red"
                    : "blue"
              }
            >
              {ticket.status.replace("_", " ")}
            </Badge>
            {ticket.mealOption && (
              <Badge tone="amber">{ticket.mealOption.name}</Badge>
            )}
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            {ticket.holderName || ticket.order.buyerName}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Show this QR at the door for check-in — one scan per person.
          </p>
          <div className="mt-4 flex justify-center">
            <ShareButton
              url={`/t/${ticket.code}`}
              title={`${e.title} — ticket`}
              text={`My ticket for ${e.title}`}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-zinc-400">
            Ticket {ticket.code}
          </p>
        </Card>
        <div className="mt-4">
          <InviteCard
            eventTitle={e.title}
            eventSlug={e.slug}
            inviteCode={inviteCode}
            friendCount={friendCount}
            eventDateLabel={dateLabel}
          />
        </div>
        <SponsorsStrip ads={e.sponsorAds || []} />
      </div>
    </Container>
  );
}
