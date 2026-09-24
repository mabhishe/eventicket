"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Container,
  Card,
  PageTitle,
  Badge,
  Field,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
  ErrorNote,
} from "@/components/ui";
import { formatCents } from "@/lib/money";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  quantityTotal: number;
  includesMeal: boolean;
};
type MealOption = { id: string; name: string; tag: string | null };
type ProgramItem = {
  id: string;
  timeLabel: string;
  title: string;
  description: string | null;
};
type EventData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  date: string;
  venue: string | null;
  currency: string;
  status: string;
  etransferEmail: string | null;
  zelleHandle: string | null;
  cashNote: string | null;
  logoUrl: string | null;
  imageUrls: string;
  brandColor: string | null;
  ticketTypes: TicketType[];
  mealOptions: MealOption[];
  programItems: ProgramItem[];
};

const statusTone: Record<string, "zinc" | "green" | "amber"> = {
  DRAFT: "zinc",
  PUBLISHED: "green",
  CLOSED: "amber",
};

export default function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // details form
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [etransferEmail, setEtransferEmail] = useState("");
  const [zelleHandle, setZelleHandle] = useState("");
  const [cashNote, setCashNote] = useState("");

  // ticket type form
  const [ttName, setTtName] = useState("");
  const [ttPrice, setTtPrice] = useState("");
  const [ttQty, setTtQty] = useState("");
  const [ttMeal, setTtMeal] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealTag, setMealTag] = useState("");
  const [progTime, setProgTime] = useState("");
  const [progTitle, setProgTitle] = useState("");
  const [progDesc, setProgDesc] = useState("");

  // branding
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [brandColor, setBrandColor] = useState("");
  const [uploading, setUploading] = useState<"" | "logo" | "image">("");

  // sponsor ads
  type SponsorAd = {
    id: string;
    name: string;
    imageUrl: string;
    linkUrl: string | null;
  };
  const [sponsors, setSponsors] = useState<SponsorAd[]>([]);
  const [spName, setSpName] = useState("");
  const [spLink, setSpLink] = useState("");
  const [spBusy, setSpBusy] = useState(false);

  function parseGallery(raw: string | null): string[] {
    try {
      const v = JSON.parse(raw || "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const load = useCallback(async (eid: string) => {
    const res = await fetch(`/api/admin/events/${eid}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load event");
      return;
    }
    const e: EventData = data.event;
    setEvent(e);
    setTitle(e.title);
    setDate(new Date(e.date).toISOString().slice(0, 16));
    setVenue(e.venue || "");
    setDescription(e.description || "");
    setEtransferEmail(e.etransferEmail || "");
    setZelleHandle(e.zelleHandle || "");
    setCashNote(e.cashNote || "");
    setLogoUrl(e.logoUrl);
    setGallery(parseGallery(e.imageUrls));
    setBrandColor(e.brandColor || "");
  }, []);

  useEffect(() => {
    if (id) {
      load(id);
      loadSponsors(id);
    }
  }, [id, load]);

  async function patch(patchData: Record<string, unknown>) {
    if (!id) return;
    setError(null);
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchData),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    await load(id);
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    await patch({
      title,
      date: new Date(date).toISOString(),
      venue,
      description,
      etransferEmail,
      zelleHandle,
      cashNote,
    });
  }

  async function addTicketType(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    const res = await fetch(`/api/admin/events/${id}/ticket-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ttName,
        priceCents: Math.round(parseFloat(ttPrice) * 100),
        quantityTotal: parseInt(ttQty, 10),
        includesMeal: ttMeal,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not add ticket type");
      return;
    }
    setTtName("");
    setTtPrice("");
    setTtQty("");
    setTtMeal(false);
    await load(id);
  }

  async function deleteTicketType(ttId: string) {
    if (!id || !confirm("Delete this ticket type?")) return;
    const res = await fetch(`/api/admin/events/${id}/ticket-types/${ttId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Could not delete");
    else await load(id);
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    const res = await fetch(`/api/admin/events/${id}/meal-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mealName, tag: mealTag || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not add meal option");
      return;
    }
    setMealName("");
    setMealTag("");
    await load(id);
  }

  async function deleteMeal(mId: string) {
    if (!id || !confirm("Delete this meal option?")) return;
    const res = await fetch(`/api/admin/events/${id}/meal-options/${mId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Could not delete");
    else await load(id);
  }

  async function addProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    const res = await fetch(`/api/admin/events/${id}/program`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeLabel: progTime,
        title: progTitle,
        description: progDesc,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not add program item");
      return;
    }
    setProgTime("");
    setProgTitle("");
    setProgDesc("");
    await load(id);
  }

  async function deleteProgram(pId: string) {
    if (!id || !confirm("Delete this program item?")) return;
    const res = await fetch(`/api/admin/events/${id}/program/${pId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Could not delete");
    else await load(id);
  }

  async function moveProgram(pId: string, dir: "up" | "down") {
    if (!id) return;
    const res = await fetch(`/api/admin/events/${id}/program/${pId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: dir }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Could not reorder");
    else await load(id);
  }

  async function uploadMedia(kind: "logo" | "image", file: File) {
    if (!id) return;
    setError(null);
    setUploading(kind);
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    const res = await fetch(`/api/admin/events/${id}/media`, {
      method: "POST",
      body: form,
    });
    const d = await res.json();
    setUploading("");
    if (!res.ok) {
      setError(d.error || "Upload failed");
      return;
    }
    setLogoUrl(d.logoUrl);
    setGallery(d.imageUrls || []);
  }

  async function removeMedia(url: string) {
    if (!id || !confirm("Remove this image?")) return;
    const res = await fetch(`/api/admin/events/${id}/media`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Could not remove image");
      return;
    }
    setLogoUrl(d.logoUrl);
    setGallery(d.imageUrls || []);
  }

  async function loadSponsors(eid: string) {
    const res = await fetch(`/api/admin/events/${eid}/sponsors`);
    if (res.ok) setSponsors(((await res.json()).ads || []) as SponsorAd[]);
  }

  async function addSponsor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const file = (e.currentTarget.elements.namedItem("spFile") as HTMLInputElement)
      ?.files?.[0];
    if (!spName.trim()) {
      setError("Sponsor name is required");
      return;
    }
    if (!file) {
      setError("Choose a sponsor logo image");
      return;
    }
    setError(null);
    setSpBusy(true);
    const form = new FormData();
    form.append("name", spName.trim());
    if (spLink.trim()) form.append("linkUrl", spLink.trim());
    form.append("file", file);
    const res = await fetch(`/api/admin/events/${id}/sponsors`, {
      method: "POST",
      body: form,
    });
    const d = await res.json();
    setSpBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not add sponsor");
      return;
    }
    setSpName("");
    setSpLink("");
    (e.currentTarget.elements.namedItem("spFile") as HTMLInputElement).value = "";
    await loadSponsors(id);
  }

  async function deleteSponsor(adId: string) {
    if (!id || !confirm("Remove this sponsor ad?")) return;
    const res = await fetch(`/api/admin/events/${id}/sponsors`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: adId }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Could not remove sponsor");
      return;
    }
    await loadSponsors(id);
  }

  if (!event) {
    return (
      <Container>
        <ErrorNote message={error} />
        {!error && <p className="text-zinc-500">Loading…</p>}
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle
        title={event.title}
        sub={`/${event.slug}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone[event.status]}>{event.status}</Badge>
            <Link href="/admin" className={btnSecondary}>
              Back
            </Link>
          </div>
        }
      />
      <ErrorNote message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Details & payment info</h2>
          <form onSubmit={saveDetails} className="space-y-3">
            <Field label="Title">
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
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
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className={inputCls}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Interac e-Transfer email">
              <input
                className={inputCls}
                value={etransferEmail}
                onChange={(e) => setEtransferEmail(e.target.value)}
              />
            </Field>
            <Field label="Zelle handle">
              <input
                className={inputCls}
                value={zelleHandle}
                onChange={(e) => setZelleHandle(e.target.value)}
              />
            </Field>
            <Field label="Cash instructions">
              <input
                className={inputCls}
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
              />
            </Field>
            <button className={btnPrimary}>Save details</button>
          </form>

          <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="mb-2 text-sm font-semibold">Publishing</h3>
            <div className="flex flex-wrap gap-2">
              {event.status !== "PUBLISHED" && (
                <button
                  className={btnPrimary}
                  onClick={() => patch({ status: "PUBLISHED" })}
                >
                  Publish — start selling
                </button>
              )}
              {event.status === "PUBLISHED" && (
                <>
                  <button
                    className={btnSecondary}
                    onClick={() => patch({ status: "DRAFT" })}
                  >
                    Unpublish
                  </button>
                  <button
                    className={btnSecondary}
                    onClick={() => patch({ status: "CLOSED" })}
                  >
                    Close sales
                  </button>
                </>
              )}
              {event.status === "CLOSED" && (
                <button
                  className={btnSecondary}
                  onClick={() => patch({ status: "PUBLISHED" })}
                >
                  Re-open sales
                </button>
              )}
            </div>
            {event.status === "PUBLISHED" && (
              <p className="mt-2 text-sm">
                Public link:{" "}
                <Link href={`/e/${event.slug}`} className="underline">
                  /e/{event.slug}
                </Link>
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">Branding</h2>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium">Logo</p>
                {logoUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={logoUrl}
                      alt="Event logo"
                      className="h-14 w-auto max-w-[12rem] rounded object-contain"
                    />
                    <button
                      className={btnDanger}
                      onClick={() => removeMedia(logoUrl)}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No logo yet.</p>
                )}
                <label className="mt-2 inline-block cursor-pointer">
                  <span className={btnSecondary + " inline-block"}>
                    {uploading === "logo" ? "Uploading…" : "Upload logo"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading !== ""}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadMedia("logo", f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <p className="mb-1 text-sm font-medium">
                  Event images ({gallery.length}/12)
                </p>
                {gallery.length > 0 && (
                  <div className="mb-2 grid grid-cols-3 gap-2">
                    {gallery.map((u) => (
                      <div key={u} className="relative">
                        <img
                          src={u}
                          alt=""
                          className="h-20 w-full rounded object-cover"
                        />
                        <button
                          className="absolute right-1 top-1 rounded bg-zinc-900/70 px-1.5 py-0.5 text-xs text-white"
                          onClick={() => removeMedia(u)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {gallery.length < 12 && (
                  <label className="inline-block cursor-pointer">
                    <span className={btnSecondary + " inline-block"}>
                      {uploading === "image" ? "Uploading…" : "Add image"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploading !== ""}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadMedia("image", f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    patch({ brandColor });
                  }}
                  className="flex items-end gap-2"
                >
                  <div className="flex-1">
                    <Field label="Brand color (buttons)">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={/^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#18181b"}
                          onChange={(e) => setBrandColor(e.target.value)}
                          className="h-10 w-12 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
                        />
                        <input
                          className={inputCls}
                          value={brandColor}
                          onChange={(e) => setBrandColor(e.target.value)}
                          placeholder="#1a73e8"
                          maxLength={7}
                        />
                      </div>
                    </Field>
                  </div>
                  <button className={btnSecondary}>Save</button>
                </form>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Sponsor ads</h2>
            <p className="mb-3 text-sm text-zinc-500">
              Sponsor logos appear on the event page, the order page, and
              tickets. A logo with a link opens it in a new tab.
            </p>
            <div className="mb-4 space-y-2">
              {sponsors.length === 0 && (
                <p className="text-sm text-zinc-500">None yet.</p>
              )}
              {sponsors.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={s.imageUrl}
                      alt={s.name}
                      className="h-12 w-auto max-w-28 shrink-0 rounded object-contain"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      {s.linkUrl && (
                        <p className="truncate text-xs text-zinc-500">
                          {s.linkUrl}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    className={btnDanger}
                    onClick={() => deleteSponsor(s.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={addSponsor}
              className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <Field label="Sponsor name">
                <input
                  className={inputCls}
                  value={spName}
                  onChange={(e) => setSpName(e.target.value)}
                  placeholder="Acme Foods"
                />
              </Field>
              <Field label="Website link (optional)">
                <input
                  className={inputCls}
                  value={spLink}
                  onChange={(e) => setSpLink(e.target.value)}
                  placeholder="https://example.com"
                />
              </Field>
              <Field label="Logo image (JPG/PNG/WebP/GIF, max 5 MB)">
                <input
                  type="file"
                  name="spFile"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="text-sm"
                />
              </Field>
              <button className={btnSecondary} disabled={spBusy}>
                {spBusy ? "Adding…" : "Add sponsor"}
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Ticket types</h2>
            <div className="mb-4 space-y-2">
              {event.ticketTypes.length === 0 && (
                <p className="text-sm text-zinc-500">
                  None yet — add at least one to sell.
                </p>
              )}
              {event.ticketTypes.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-zinc-500">
                      {formatCents(t.priceCents, event.currency)} ·{" "}
                      {t.quantityTotal} seats
                      {t.includesMeal ? " · includes meal" : ""}
                    </p>
                  </div>
                  <button
                    className={btnDanger}
                    onClick={() => deleteTicketType(t.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={addTicketType} className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <Field label="Name">
                <input
                  className={inputCls}
                  value={ttName}
                  onChange={(e) => setTtName(e.target.value)}
                  placeholder="General admission"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price">
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={ttPrice}
                    onChange={(e) => setTtPrice(e.target.value)}
                    placeholder="25.00"
                    required
                  />
                </Field>
                <Field label="Seats">
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    step="1"
                    value={ttQty}
                    onChange={(e) => setTtQty(e.target.value)}
                    placeholder="100"
                    required
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ttMeal}
                  onChange={(e) => setTtMeal(e.target.checked)}
                />
                This ticket includes a meal choice
              </label>
              <button className={btnSecondary}>Add ticket type</button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Meal options</h2>
            <div className="mb-4 space-y-2">
              {event.mealOptions.length === 0 && (
                <p className="text-sm text-zinc-500">
                  None yet — only needed if a ticket type includes a meal.
                </p>
              )}
              {event.mealOptions.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <p className="text-sm font-medium">
                    {m.name}
                    {m.tag === "veg" && (
                      <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-900 dark:text-green-200">
                        VEG
                      </span>
                    )}
                    {m.tag === "nonveg" && (
                      <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-900 dark:text-red-200">
                        NON-VEG
                      </span>
                    )}
                  </p>
                  <button className={btnDanger} onClick={() => deleteMeal(m.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={addMeal}
              className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <p className="text-sm font-medium">Add a meal option</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputCls + " min-w-0 flex-1"}
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="Meal name — e.g. Veg dinner"
                  aria-label="Meal name"
                  required
                />
                <select
                  className={inputCls + " sm:w-36 sm:shrink-0"}
                  value={mealTag}
                  onChange={(e) => setMealTag(e.target.value)}
                  aria-label="Diet tag"
                >
                  <option value="">No tag</option>
                  <option value="veg">Veg</option>
                  <option value="nonveg">Non-veg</option>
                </select>
              </div>
              <button className={btnSecondary}>Add</button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Program / schedule</h2>
            <div className="mb-4 space-y-2">
              {(event?.programItems || []).length === 0 && (
                <p className="text-sm text-zinc-500">
                  None yet — add timed entries like doors, dinner, performances.
                </p>
              )}
              {(event?.programItems || []).map((p, i, arr) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {p.timeLabel && (
                        <span className="mr-2 text-xs font-semibold text-zinc-500">
                          {p.timeLabel}
                        </span>
                      )}
                      {p.title}
                    </p>
                    {p.description && (
                      <p className="truncate text-xs text-zinc-500">{p.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      className={btnSecondary + " px-2 py-1 text-xs"}
                      disabled={i === 0}
                      onClick={() => moveProgram(p.id, "up")}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className={btnSecondary + " px-2 py-1 text-xs"}
                      disabled={i === arr.length - 1}
                      onClick={() => moveProgram(p.id, "down")}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button className={btnDanger} onClick={() => deleteProgram(p.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={addProgram}
              className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <p className="text-sm font-medium">Add a program entry</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputCls + " sm:w-32 sm:shrink-0"}
                  value={progTime}
                  onChange={(e) => setProgTime(e.target.value)}
                  placeholder="Time — e.g. 6:00 PM"
                  aria-label="Time"
                />
                <input
                  className={inputCls + " min-w-0 flex-1"}
                  value={progTitle}
                  onChange={(e) => setProgTitle(e.target.value)}
                  placeholder="Title — e.g. Doors open"
                  aria-label="Title"
                  required
                />
              </div>
              <input
                className={inputCls + " w-full"}
                value={progDesc}
                onChange={(e) => setProgDesc(e.target.value)}
                placeholder="Details (optional)"
                aria-label="Details"
              />
              <button className={btnSecondary}>Add</button>
            </form>
          </Card>
        </div>
      </div>
    </Container>
  );
}
