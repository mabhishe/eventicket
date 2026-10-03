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
import { datetimeLocalToISO } from "@/lib/datetime";

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
  const [requireEntryBeforeFood, setRequireEntryBeforeFood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const iso = datetimeLocalToISO(String(fd.get("date") || ""));
    if (!iso) {
      setError("Enter a valid date and time");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(fd.get("title") || ""),
        date: iso,
        venue: String(fd.get("venue") || ""),
        description: String(fd.get("description") || ""),
        etransferEmail: String(fd.get("etransferEmail") || ""),
        zelleHandle: String(fd.get("zelleHandle") || ""),
        cashNote: String(fd.get("cashNote") || ""),
        requireEntryBeforeFood: fd.get("requireEntryBeforeFood") === "on",
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
          sub="This saves a draft. Nothing goes on sale until you publish."
        />
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Event title">
              <input
                className={inputCls}
                name="title"
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
                  name="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
              <Field label="Venue">
                <input
                  className={inputCls}
                  name="venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Community hall, Mississauga"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className={inputCls}
                name="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What guests should know…"
              />
            </Field>
            <div className="rounded-lg bg-stone-50 p-4 dark:bg-stone-800/50">
              <p className="mb-3 text-sm font-semibold">
                How guests pay you (shown at checkout)
              </p>
              <div className="space-y-3">
                <Field label="Interac e-Transfer email">
                  <input
                    className={inputCls}
                    name="etransferEmail"
                    value={etransferEmail}
                    onChange={(e) => setEtransferEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Zelle handle">
                  <input
                    className={inputCls}
                    name="zelleHandle"
                    value={zelleHandle}
                    onChange={(e) => setZelleHandle(e.target.value)}
                    placeholder="name or phone"
                  />
                </Field>
                <Field label="Cash instructions">
                  <input
                    className={inputCls}
                    name="cashNote"
                    value={cashNote}
                    onChange={(e) => setCashNote(e.target.value)}
                    placeholder="Pay at the door / see the organizer"
                  />
                </Field>
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-4 dark:border-stone-800">
              <input
                type="checkbox"
                name="requireEntryBeforeFood"
                className="mt-1 h-5 w-5"
                checked={requireEntryBeforeFood}
                onChange={(e) => setRequireEntryBeforeFood(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium">
                  Require entry scan before food is served
                </span>
                <span className="block text-xs text-stone-500">
                  Guests must be checked in at the door before the food line
                  will serve them. Off by default.
                </span>
              </span>
            </label>
            <ErrorNote message={error} />
            <div className="flex gap-2">
              <button className={btnPrimary} type="submit" disabled={busy}>
                {busy ? "Saving draft…" : "Save draft"}
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
