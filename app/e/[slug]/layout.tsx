import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  eventShareDescription,
  eventShareTitle,
  requestMetadataBase,
} from "@/lib/eventShare";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    include: { organization: { select: { timezone: true } } },
  });
  const metadataBase = await requestMetadataBase();
  if (!event || event.status !== "PUBLISHED") {
    return { title: "EventPass", ...(metadataBase ? { metadataBase } : {}) };
  }
  const title = eventShareTitle(event.title);
  const description = eventShareDescription({
    date: event.date,
    venue: event.venue,
    description: event.description,
    timeZone: event.timezone || event.organization?.timezone,
  });
  return {
    ...(metadataBase ? { metadataBase } : {}),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    alternates: { canonical: `/e/${slug}` },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function EventShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
