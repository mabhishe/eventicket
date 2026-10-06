import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadPublicEvent } from "@/lib/publicEvent";
import EventView from "./event-view";
import { EventPageSkeleton } from "./skeleton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublicEventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const data = await loadPublicEvent(slug);
  if (!data) notFound();
  return (
    <Suspense fallback={<EventPageSkeleton />}>
      <EventView initial={data} search={search} />
    </Suspense>
  );
}
