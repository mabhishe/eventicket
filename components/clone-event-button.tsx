"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/components/ui";

export function CloneEventButton({
  eventId,
  className = "",
}: {
  eventId: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clone() {
    if (
      !confirm(
        "Clone this event without its guests? Orders, tickets, and payments stay on the original. The copy opens as a draft so you can set the new date."
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/events/${eventId}/clone`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.event?.id) {
      setBusy(false);
      alert(data.error || "Could not clone this event");
      return;
    }
    router.push(`/admin/events/${data.event.id}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={`${btnSecondary} ${className}`}
      disabled={busy}
      onClick={clone}
    >
      {busy ? "Cloning…" : "Clone"}
    </button>
  );
}
