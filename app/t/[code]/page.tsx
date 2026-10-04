import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ticketQrDataUrl } from "@/lib/tickets";
import { ensureOrderRefCode, ensureOrderInviteCode } from "@/lib/orders";
import { Container, Card, Badge } from "@/components/ui";
import { SponsorsStrip } from "@/components/sponsors-strip";
import { ShareButton } from "@/components/ShareButton";
import { InviteCard } from "@/components/invite-card";
import { formatEventWhen } from "@/lib/datetime";
import { eventPreviewVersion } from "@/lib/eventPreview";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export default async function TicketPage({ params }: Ctx) {
  const { code } = await params;
  const ticket = await db.ticket.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      ticketType: true,
      mealOption: true,
      order: { include: { event: { include: { sponsorAds: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }, organization: { select: { timezone: true } } } } } },
    },
  });
  if (!ticket) notFound();

  const e = ticket.order.event;
  // The group pass: one code for the whole order, scanned once per person.
  const groupCode = await ensureOrderRefCode(ticket.order.id);
  const personalQr = await ticketQrDataUrl(ticket.code);
  const inviteCode = await ensureOrderInviteCode(ticket.order.id);
  const friendCount = await db.order.count({
    where: { eventId: e.id, invitedBy: inviteCode },
  });
  const partySize = await db.ticket.count({
    where: { orderId: ticket.order.id, status: { not: "CANCELLED" } },
  });
  const dateLabel = formatEventWhen(e.date, e.organization?.timezone);
  let bannerUrl: string | null = null;
  try {
    const g = JSON.parse(e.imageUrls || "[]");
    if (Array.isArray(g)) bannerUrl = g.find((x) => typeof x === "string") || null;
  } catch {
    bannerUrl = null;
  }

  return (
    <Container>
      <div className="mx-auto max-w-sm">
        <Card className="text-center">
          <p className="text-sm text-stone-500">{e.title}</p>
          <h1 className="mt-1 text-xl font-bold">
            {ticket.holderName || ticket.order.buyerName}
          </h1>
          <p className="text-sm text-stone-500">{ticket.ticketType.name}</p>
          <p className="text-sm text-stone-500">
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
            src={personalQr}
            alt={`Ticket for ${ticket.holderName || ticket.order.buyerName}`}
            className="mx-auto mt-4 h-56 w-56"
          />
          <p className="mt-3 font-mono text-2xl font-bold tracking-widest">
            {ticket.code}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            This QR is only for {ticket.holderName || ticket.order.buyerName}.
            Show it at the door and at the food line.
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
          <p className="mt-3 text-xs text-stone-400">
            Family lookup {groupCode}
            {partySize > 1 ? ` · ${partySize} people on this order` : ""}. Staff
            can search it and pick a name. It does not check someone in by itself.
          </p>
          <div className="mt-4 flex justify-center">
            <ShareButton
              url={`/t/${ticket.code}`}
              title={`${e.title} — ticket`}
              text={`My ticket for ${e.title}`}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-stone-400">
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
            venue={e.venue}
            bannerUrl={bannerUrl}
            logoUrl={e.logoUrl}
            previewVersion={eventPreviewVersion({
              title: e.title,
              date: e.date,
              venue: e.venue,
              description: e.description,
            })}
          />
        </div>
        <SponsorsStrip ads={e.sponsorAds || []} />
      </div>
    </Container>
  );
}
