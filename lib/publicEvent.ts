import { db } from "@/lib/db";
import { ticketAvailability } from "@/lib/orders";
import { sortSponsorAds } from "@/lib/sponsors";
import { PLANS, planOf } from "@/lib/plans";
import { eventTimeZone } from "@/lib/datetime";

/** Published event payload for the public page. Null when it is not on sale. */
export async function loadPublicEvent(slug: string) {
  const event = await db.event.findUnique({
    where: { slug },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      mealOptions: { orderBy: { sortOrder: "asc" } },
      programItems: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      sponsorAds: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      organization: { select: { plan: true, timezone: true } },
    },
  });
  if (!event || event.status !== "PUBLISHED") return null;

  const availability = await ticketAvailability(event.id);
  const { organization, ...rest } = event;
  const wallOrders = await db.order.findMany({
    where: { eventId: event.id, status: "CONFIRMED", showOnWall: true },
    select: {
      buyerName: true,
      tickets: { select: { status: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const attendeeWall = wallOrders.map((o) => {
    const parts = o.buyerName.trim().split(/\s+/);
    const display =
      parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0];
    return {
      name: display,
      partySize: o.tickets.filter((t) => t.status !== "CANCELLED").length,
    };
  });

  return JSON.parse(
    JSON.stringify({
      event: {
        ...rest,
        date: rest.date.toISOString(),
        timezone: eventTimeZone(rest.timezone || organization?.timezone),
        sponsorAds: sortSponsorAds(event.sponsorAds),
      },
      availability,
      attendeeWall,
      showBadge: PLANS[planOf(organization)].showBadge,
    })
  ) as {
    event: {
      id: string;
      slug: string;
      title: string;
      description: string | null;
      date: string;
      timezone: string;
      venue: string | null;
      currency: string;
      etransferEmail: string | null;
      zelleHandle: string | null;
      cashNote: string | null;
      logoUrl: string | null;
      imageUrls: string;
      brandColor: string | null;
      registrationFields: string | null;
      sponsorAds: {
        id: string;
        name: string;
        imageUrl: string | null;
        linkUrl: string | null;
        tier: string;
        sortOrder: number;
      }[];
      programItems: {
        id: string;
        timeLabel: string;
        title: string;
        description: string | null;
      }[];
      ticketTypes: {
        id: string;
        name: string;
        description: string | null;
        priceCents: number;
        quantityTotal: number;
        includesMeal: boolean;
      }[];
      mealOptions: {
        id: string;
        name: string;
        description: string | null;
        tag: string | null;
      }[];
    };
    availability: Record<string, { left: number }>;
    attendeeWall: { name: string; partySize: number }[];
    showBadge: boolean;
  };
}

export type PublicEventData = NonNullable<
  Awaited<ReturnType<typeof loadPublicEvent>>
>;
