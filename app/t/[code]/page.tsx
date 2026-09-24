import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ticketQrDataUrl } from "@/lib/tickets";
import { Container, Card, Badge } from "@/components/ui";
import { SponsorsStrip } from "@/components/sponsors-strip";

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
  const qr = await ticketQrDataUrl(ticket.code);

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
            alt={`Ticket ${ticket.code}`}
            className="mx-auto mt-4 h-56 w-56"
          />
          <p className="mt-3 font-mono text-2xl font-bold tracking-widest">
            {ticket.code}
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
            Show this QR at the door for check-in.
          </p>
        </Card>
        <SponsorsStrip ads={e.sponsorAds || []} />
      </div>
    </Container>
  );
}
