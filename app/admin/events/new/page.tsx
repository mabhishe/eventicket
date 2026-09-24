"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  btnPrimary,
  btnSecondary,
  ErrorNote,
} from "@/components/ui";

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => toLocalInput(new Date(Date.now() + 14 * 864e5)));
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [etransferEmail, setEtransferEmail] = useState("");
  const [zelleHandle, setZelleHandle] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        date: new Date(date).toISOString(),
        venue,
        description,
        etransferEmail,
        zelleHandle,
        cashNote,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create event");
      setBusy(false);
      return;
    }
    router.push(`/admin/events/${data.event.id}`);
  }

  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <PageTitle
          title="New event"
          sub="It starts as a draft — add ticket types, then publish when ready."
        />
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Event title">
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Community Diwali Night 2026"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date & time">
                <input
                  className={inputCls}
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
              <Field label="Venue">
                <input
                  className={inputCls}
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Community hall, Mississauga"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className={inputCls}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What guests should know…"
              />
            </Field>
            <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <p className="mb-3 text-sm font-semibold">
                How guests pay you (shown at checkout)
              </p>
              <div className="space-y-3">
                <Field label="Interac e-Transfer email">
                  <input
                    className={inputCls}
                    value={etransferEmail}
                    onChange={(e) => setEtransferEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Zelle handle">
                  <input
                    className={inputCls}
                    value={zelleHandle}
                    onChange={(e) => setZelleHandle(e.target.value)}
                    placeholder="name or phone"
                  />
                </Field>
                <Field label="Cash instructions">
                  <input
                    className={inputCls}
                    value={cashNote}
                    onChange={(e) => setCashNote(e.target.value)}
                    placeholder="Pay at the door / see the organizer"
                  />
                </Field>
              </div>
            </div>
            <ErrorNote message={error} />
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={busy}>
                {busy ? "Creating…" : "Create event"}
              </button>
              <Link href="/admin" className={btnSecondary}>
                Cancel
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </Container>
  );
}
