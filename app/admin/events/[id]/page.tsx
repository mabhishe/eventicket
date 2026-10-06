"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { CloneEventButton } from "@/components/clone-event-button";
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
import {
  SPONSOR_TIERS,
  TIER_LABELS,
  TIER_LOGO_CLASS,
  TIER_SINGULAR,
  normalizeTier,
} from "@/lib/sponsors";
import {
  ImageCropDialog,
  SponsorLogoDialog,
  isAcceptedImage,
} from "@/components/image-crop-dialog";
import { datetimeLocalToISO, toDatetimeLocalValue } from "@/lib/datetime";
import { eventPreviewVersion, withPreviewVersion } from "@/lib/eventPreview";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  quantityTotal: number;
  includesMeal: boolean;
};
type MealOption = {
  id: string;
  name: string;
  description: string | null;
  tag: string | null;
};
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
  timezone?: string | null;
  venue: string | null;
  currency: string;
  status: string;
  etransferEmail: string | null;
  zelleHandle: string | null;
  cashNote: string | null;
  logoUrl: string | null;
  imageUrls: string;
  brandColor: string | null;
  requireEntryBeforeFood: boolean;
  ticketTypes: TicketType[];
  mealOptions: MealOption[];
  programItems: ProgramItem[];
};

const statusTone: Record<string, "stone" | "green" | "amber"> = {
  DRAFT: "stone",
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
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);

  // details form
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [etransferEmail, setEtransferEmail] = useState("");
  const [zelleHandle, setZelleHandle] = useState("");
  const [cashNote, setCashNote] = useState("");
  const [detailsNote, setDetailsNote] = useState<string | null>(null);
  const detailsRef = useRef<HTMLFormElement>(null);

  // ticket type form
  const [ttName, setTtName] = useState("");
  const [ttDesc, setTtDesc] = useState("");
  const [ttPrice, setTtPrice] = useState("");
  const [ttQty, setTtQty] = useState("");
  const [ttMeal, setTtMeal] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealDesc, setMealDesc] = useState("");
  const [mealTag, setMealTag] = useState("");
  const [mealError, setMealError] = useState<string | null>(null);
  const [progTime, setProgTime] = useState("");
  const [progTitle, setProgTitle] = useState("");
  const [progDesc, setProgDesc] = useState("");

  // branding
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [brandColor, setBrandColor] = useState("");
  const [uploading, setUploading] = useState<"" | "logo" | "image">("");
  type CropPurpose = "logo" | "banner" | "photo" | "sponsor-new" | "sponsor-edit";
  const [crop, setCrop] = useState<{ file: File; purpose: CropPurpose } | null>(null);
  const [sponsorLogo, setSponsorLogo] = useState<{
    file: File;
    purpose: "sponsor-new" | "sponsor-edit";
  } | null>(null);

  // sponsor ads
  type SponsorAd = {
    id: string;
    name: string;
    imageUrl: string | null;
    linkUrl: string | null;
    tier: string;
    impressions: number;
    clicks: number;
  };
  const [sponsors, setSponsors] = useState<SponsorAd[]>([]);
  const [spName, setSpName] = useState("");
  const [spLink, setSpLink] = useState("");
  const [spTier, setSpTier] = useState<string>("SILVER");
  const [spBusy, setSpBusy] = useState(false);
  const [sponsorNote, setSponsorNote] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  // bulk add
  const [bulkTier, setBulkTier] = useState<string>("SILVER");
  const [bulkLink, setBulkLink] = useState("");
  const [bulkNames, setBulkNames] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  // inline sponsor editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editTier, setEditTier] = useState<string>("SILVER");
  const [editBusy, setEditBusy] = useState(false);
  // invites & who's-going wall
  const [topInviters, setTopInviters] = useState<
    { name: string; inviteCode: string; joins: number }[]
  >([]);
  const [wallCount, setWallCount] = useState(0);

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
    setDate(toDatetimeLocalValue(new Date(e.date), e.timezone));
    setVenue(e.venue || "");
    setDescription(e.description || "");
    setEtransferEmail(e.etransferEmail || "");
    setZelleHandle(e.zelleHandle || "");
    setCashNote(e.cashNote || "");
    setLogoUrl(e.logoUrl);
    setGallery(parseGallery(e.imageUrls));
    setBrandColor(e.brandColor || "");
    setTopInviters(data.topInviters || []);
    setWallCount(data.wallCount || 0);
  }, []);

  useEffect(() => {
    if (id) {
      load(id);
      loadSponsors(id);
    }
  }, [id, load]);

  async function patch(patchData: Record<string, unknown>): Promise<boolean> {
    if (!id) return false;
    setError(null);
    setUpgradeNeeded(false);
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchData),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save");
      setUpgradeNeeded(!!data.upgradeRequired);
      return false;
    }
    await load(id);
    return true;
  }

  function detailsPayload(): Record<string, unknown> | null {
    const form = detailsRef.current;
    if (!form) return null;
    const fd = new FormData(form);
    const iso = datetimeLocalToISO(String(fd.get("date") || ""), event?.timezone);
    if (!iso) {
      setError("Enter a valid date and time");
      return null;
    }
    return {
      title: String(fd.get("title") || ""),
      date: iso,
      venue: String(fd.get("venue") || ""),
      description: String(fd.get("description") || ""),
      etransferEmail: String(fd.get("etransferEmail") || ""),
      zelleHandle: String(fd.get("zelleHandle") || ""),
      cashNote: String(fd.get("cashNote") || ""),
    };
  }

  async function saveDetails(e?: React.FormEvent) {
    e?.preventDefault();
    setDetailsNote(null);
    const payload = detailsPayload();
    if (!payload) return false;
    const ok = await patch(payload);
    if (ok) {
      setDetailsNote(
        event?.status === "PUBLISHED"
          ? "Saved. The public page uses this date. Copy the public link again so a new chat shows it."
          : "Draft saved. It stays off the public page until you publish."
      );
    }
    return ok;
  }

  async function publishEvent() {
    setDetailsNote(null);
    const payload = detailsPayload();
    if (!payload) return;
    const saved = await patch(payload);
    if (!saved) return;
    setDetailsNote("Draft saved.");
    const ok = await patch({ status: "PUBLISHED" });
    if (ok) setDetailsNote("Published. Guests can buy tickets now.");
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
        description: ttDesc,
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
    setTtDesc("");
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
      body: JSON.stringify({
        name: mealName,
        description: mealDesc,
        tag: mealTag || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMealError(data.error || "Could not add meal option");
      return;
    }
    setMealError(null);
    setMealName("");
    setMealDesc("");
    setMealTag("");
    await load(id);
  }

  async function deleteMeal(mId: string, force = false) {
    if (!id) return;
    if (!force && !confirm("Delete this meal option?")) return;
    setMealError(null);
    const res = await fetch(
      `/api/admin/events/${id}/meal-options/${mId}${force ? "?force=1" : ""}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (res.status === 400 && data.inUse && !force) {
      const ok = confirm(
        `${data.error}\n\nDelete it anyway? That meal will be cleared on those orders, and those guests will need a meal chosen again.`
      );
      if (ok) return deleteMeal(mId, true);
      setMealError(data.error);
      return;
    }
    if (!res.ok) setMealError(data.error || "Could not delete");
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

  function beginCrop(file: File, purpose: CropPurpose) {
    if (!isAcceptedImage(file)) {
      setError("Only JPG, PNG, WebP, or GIF images are allowed");
      return;
    }
    setError(null);
    setCrop({ file, purpose });
  }

  async function uploadMedia(kind: "logo" | "image", file: File) {
    if (!id) return null;
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
      return null;
    }
    setLogoUrl(d.logoUrl);
    const urls = (d.imageUrls || []) as string[];
    setGallery(urls);
    return urls;
  }

  async function saveGalleryOrder(next: string[]) {
    if (!id) return false;
    setGallery(next);
    const res = await fetch(`/api/admin/events/${id}/media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrls: next }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Could not reorder images");
      return false;
    }
    setGallery(d.imageUrls || []);
    return true;
  }

  async function deleteMedia(url: string) {
    if (!id) return;
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

  async function removeMedia(url: string, message = "Remove this image?") {
    if (!confirm(message)) return;
    await deleteMedia(url);
  }

  async function applyCroppedFile(file: File, purpose: CropPurpose) {
    if (purpose === "logo") {
      await uploadMedia("logo", file);
      return;
    }
    if (purpose === "photo") {
      await uploadMedia("image", file);
      return;
    }
    if (purpose === "banner") {
      const previous = gallery[0];
      const urls = await uploadMedia("image", file);
      if (!urls) return;
      const newest = urls[urls.length - 1];
      const ordered = [newest, ...urls.filter((u) => u !== newest)];
      if (ordered[0] !== urls[0] || ordered.length !== urls.length) {
        const ok = await saveGalleryOrder(ordered);
        if (!ok) return;
      }
      if (previous && previous !== newest) await deleteMedia(previous);
      return;
    }
    if (purpose === "sponsor-new") {
      await postSponsor(file);
      return;
    }
    if (purpose === "sponsor-edit" && editingId) {
      await commitSponsorEdit(editingId, file);
    }
  }

  async function movePhoto(photoIdx: number, dir: -1 | 1) {
    const idx = photoIdx + 1;
    const j = idx + dir;
    if (j < 1 || j >= gallery.length) return;
    const next = [...gallery];
    [next[idx], next[j]] = [next[j], next[idx]];
    await saveGalleryOrder(next);
  }

  async function makeBanner(url: string) {
    await saveGalleryOrder([url, ...gallery.filter((u) => u !== url)]);
  }

  async function loadSponsors(eid: string) {
    const res = await fetch(`/api/admin/events/${eid}/sponsors`);
    if (res.ok) {
      const list = (((await res.json()).ads || []) as SponsorAd[]).map((s) => ({
        ...s,
        tier: normalizeTier(s.tier),
      }));
      setSponsors(list);
    }
  }

  async function postSponsor(file: File | null) {
    if (!id) return;
    if (!spName.trim()) {
      setError("Sponsor name is required");
      return;
    }
    setError(null);
    setSponsorNote(null);
    setSpBusy(true);
    const savedName = spName.trim();
    const form = new FormData();
    form.append("name", savedName);
    form.append("tier", spTier);
    if (spLink.trim()) form.append("linkUrl", spLink.trim());
    if (file) form.append("file", file);
    const res = await fetch(`/api/admin/events/${id}/sponsors`, {
      method: "POST",
      body: form,
    });
    const d = await res.json();
    setSpBusy(false);
    if (!res.ok) {
      const message = d.error || "Could not add sponsor";
      setError(message);
      setSponsorNote({ ok: false, text: message });
      return;
    }
    setSpName("");
    setSpLink("");
    setSpTier("SILVER");
    setSponsorNote({ ok: true, text: `${savedName} is on the public page.` });
    const input = document.querySelector<HTMLInputElement>("input[name=spFile]");
    if (input) input.value = "";
    await loadSponsors(id);
  }

  function addSponsor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem("spFile") as HTMLInputElement)
      ?.files?.[0];
    if (!spName.trim()) {
      setError("Sponsor name is required");
      return;
    }
    if (file && !isAcceptedImage(file)) {
      const message = "Only JPG, PNG, WebP, or GIF images are allowed";
      setError(message);
      setSponsorNote({ ok: false, text: message });
      return;
    }
    setError(null);
    void postSponsor(file || null);
  }

  async function addSponsorsBulk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const input = e.currentTarget.elements.namedItem(
      "bulkFiles"
    ) as HTMLInputElement;
    const files = input?.files;
    if (!files || files.length === 0) {
      setError("Choose one or more logo images to bulk-add");
      return;
    }
    setError(null);
    setBulkBusy(true);
    const form = new FormData();
    form.append("tier", bulkTier);
    if (bulkLink.trim()) form.append("linkUrl", bulkLink.trim());
    if (bulkNames.trim()) form.append("names", bulkNames.trim());
    for (const f of Array.from(files)) form.append("files", f);
    const res = await fetch(`/api/admin/events/${id}/sponsors`, {
      method: "POST",
      body: form,
    });
    const d = await res.json();
    setBulkBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not add sponsors");
      return;
    }
    const n = (d.ads || []).length;
    setBulkNames("");
    setBulkLink("");
    input.value = "";
    await loadSponsors(id);
    setError(null);
    alert(`Added ${n} sponsor${n === 1 ? "" : "s"}.`);
  }

  async function setSponsorTier(adId: string, tier: string) {
    if (!id) return;
    const res = await fetch(`/api/admin/events/${id}/sponsors`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: adId, tier }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Could not update tier");
      return;
    }
    await loadSponsors(id);
  }

  function startEditSponsor(s: SponsorAd) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditLink(s.linkUrl || "");
    setEditTier(s.tier);
    setError(null);
  }

  async function commitSponsorEdit(adId: string, file?: File) {
    if (!id) return;
    if (!editName.trim()) {
      setError("Sponsor name is required");
      return;
    }
    setError(null);
    setEditBusy(true);
    const form = new FormData();
    form.append("id", adId);
    form.append("name", editName.trim());
    form.append("tier", editTier);
    form.append("linkUrl", editLink.trim());
    if (file) form.append("file", file);
    const res = await fetch(`/api/admin/events/${id}/sponsors`, {
      method: "PATCH",
      body: form,
    });
    const d = await res.json();
    setEditBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not save sponsor");
      return;
    }
    setEditingId(null);
    await loadSponsors(id);
  }

  function saveSponsorEdit(e: React.FormEvent<HTMLFormElement>, adId: string) {
    e.preventDefault();
    if (!editName.trim()) {
      setError("Sponsor name is required");
      return;
    }
    const file = (
      e.currentTarget.elements.namedItem("editFile") as HTMLInputElement
    )?.files?.[0];
    if (file) {
      if (!isAcceptedImage(file)) {
        setError("Only JPG, PNG, WebP, or GIF images are allowed");
        return;
      }
      setError(null);
      setSponsorLogo({ file, purpose: "sponsor-edit" });
      return;
    }
    void commitSponsorEdit(adId);
  }

  async function moveSponsor(adId: string, move: "up" | "down") {
    if (!id) return;
    const res = await fetch(`/api/admin/events/${id}/sponsors`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: adId, move }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Could not reorder sponsor");
      return;
    }
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
        {!error && <p className="text-stone-500">Loading…</p>}
      </Container>
    );
  }

  const publicPath = withPreviewVersion(
    `/e/${event.slug}`,
    eventPreviewVersion({
      title: event.title,
      date: event.date,
      venue: event.venue,
      description: event.description,
    })
  );

  return (
    <Container>
      <PageTitle
        title={event.title}
        sub={`/${event.slug}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone[event.status]}>{event.status}</Badge>
            <CloneEventButton eventId={event.id} />
            <Link href="/admin" className={btnSecondary}>
              Back
            </Link>
          </div>
        }
      />
      <ErrorNote message={error} />
      {upgradeNeeded && (
        <p className="mt-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This is a Free-plan limit.{" "}
          <Link href="/admin/settings" className="font-semibold underline">
            Upgrade to Pro
          </Link>{" "}
          for unlimited events.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Details & payment info</h2>
          <form ref={detailsRef} onSubmit={saveDetails} className="space-y-3">
            <Field label="Title">
              <input
                className={inputCls}
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Date & time (${event?.timezone || "America/Toronto"})`}>
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
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className={inputCls}
                name="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Interac e-Transfer email">
              <input
                className={inputCls}
                name="etransferEmail"
                value={etransferEmail}
                onChange={(e) => setEtransferEmail(e.target.value)}
              />
            </Field>
            <Field label="Zelle handle">
              <input
                className={inputCls}
                name="zelleHandle"
                value={zelleHandle}
                onChange={(e) => setZelleHandle(e.target.value)}
              />
            </Field>
            <Field label="Cash instructions">
              <input
                className={inputCls}
                name="cashNote"
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
              />
            </Field>
            <button className={btnPrimary} type="submit">
              Save details
            </button>
            {detailsNote && (
              <p className="text-sm text-green-700 dark:text-green-400">{detailsNote}</p>
            )}
            <p className="text-xs text-stone-500">
              Saving keeps this event as a draft. Guests cannot buy tickets until you publish.
            </p>
          </form>

          <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-800">
            <h3 className="mb-2 text-sm font-semibold">Publishing</h3>
            <div className="flex flex-wrap gap-2">
              {event.status !== "PUBLISHED" && (
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={publishEvent}
                >
                  Publish — start selling
                </button>
              )}
              {event.status === "PUBLISHED" && (
                <>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => patch({ status: "DRAFT" })}
                  >
                    Unpublish
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => patch({ status: "CLOSED" })}
                  >
                    Close sales
                  </button>
                </>
              )}
              {event.status === "CLOSED" && (
                <button
                  type="button"
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
                <Link href={publicPath} className="underline break-all">
                  {publicPath}
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
                <p className="mb-2 text-xs text-stone-500">
                  Square crop, shown beside the event title. A PNG of the mark
                  works best.
                </p>
                {logoUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={logoUrl}
                      alt="Event logo"
                      className="h-20 w-20 rounded-2xl border border-stone-200 object-contain dark:border-stone-800"
                    />
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => removeMedia(logoUrl)}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">No logo yet.</p>
                )}
                <label className="mt-2 inline-block cursor-pointer">
                  <span className={btnSecondary + " inline-block"}>
                    {uploading === "logo" ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading !== ""}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) beginCrop(f, "logo");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="border-t border-stone-200 pt-4 dark:border-stone-800">
                <p className="mb-1 text-sm font-medium">Banner</p>
                <p className="mb-2 text-xs text-stone-500">
                  Buyers see this across the top of the event page. Crop to a
                  wide frame and keep the title in the center.
                </p>
                {gallery[0] ? (
                  <div className="mb-2 overflow-hidden rounded-2xl">
                    <img
                      src={gallery[0]}
                      alt="Event banner preview"
                      className="h-56 w-full object-cover sm:h-72"
                    />
                  </div>
                ) : (
                  <p className="mb-2 text-sm text-stone-500">No banner yet.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {gallery.length >= 12 ? (
                    <p className="text-xs text-stone-500">
                      Remove a photo before replacing the banner.
                    </p>
                  ) : (
                  <label className="inline-block cursor-pointer">
                    <span className={btnSecondary + " inline-block"}>
                      {uploading === "image" ? "Uploading…" : gallery[0] ? "Replace banner" : "Add banner"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploading !== ""}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) beginCrop(f, "banner");
                        e.target.value = "";
                      }}
                    />
                  </label>
                  )}
                  {gallery[0] && (
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() =>
                        removeMedia(
                          gallery[0],
                          gallery.length > 1
                            ? "Remove the banner? The next photo will become the banner."
                            : "Remove this banner?"
                        )
                      }
                    >
                      Remove banner
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-stone-200 pt-4 dark:border-stone-800">
                <p className="mb-1 text-sm font-medium">
                  More photos ({Math.max(0, gallery.length - 1)}/{gallery[0] ? 11 : 12})
                </p>
                <p className="mb-2 text-xs text-stone-500">
                  Shown in a short strip under the description. Use “Make banner”
                  to move one to the top.
                </p>
                {gallery.length > 1 && (
                  <div className="mb-2 grid grid-cols-3 gap-2">
                    {gallery.slice(1).map((u, photoIdx) => (
                      <div key={u} className="relative">
                        <img
                          src={u}
                          alt=""
                          className="h-20 w-full rounded object-cover"
                        />
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded bg-stone-900/70 px-1.5 py-0.5 text-xs text-white"
                          onClick={() => removeMedia(u)}
                        >
                          ✕
                        </button>
                        <div className="absolute bottom-1 left-1 flex gap-1">
                          <button
                            type="button"
                            className="rounded bg-stone-900/70 px-1.5 py-0.5 text-xs text-white disabled:opacity-30"
                            disabled={photoIdx === 0}
                            onClick={() => movePhoto(photoIdx, -1)}
                            title="Move earlier"
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            className="rounded bg-stone-900/70 px-1.5 py-0.5 text-xs text-white disabled:opacity-30"
                            disabled={photoIdx === gallery.length - 2}
                            onClick={() => movePhoto(photoIdx, 1)}
                            title="Move later"
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            className="rounded bg-stone-900/70 px-1.5 py-0.5 text-xs text-white"
                            onClick={() => makeBanner(u)}
                          >
                            Banner
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {gallery.length < 12 && (
                  <label className="inline-block cursor-pointer">
                    <span className={btnSecondary + " inline-block"}>
                      {uploading === "image" ? "Uploading…" : "Add photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploading !== ""}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) beginCrop(f, "photo");
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="border-t border-stone-200 pt-4 dark:border-stone-800">
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
                          className="h-10 w-12 cursor-pointer rounded border border-stone-300 dark:border-stone-700"
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
            <h2 className="mb-3 font-semibold">Invites & who&rsquo;s going</h2>
            <p className="mb-3 text-sm text-stone-500">
              Every order gets a personal invite link (?invite=) on the order
              and ticket pages. {wallCount} {wallCount === 1 ? "buyer has" : "buyers have"} opted
              into the public who&rsquo;s-going wall.
            </p>
            {topInviters.length === 0 ? (
              <p className="text-sm text-stone-500">
                No invite-driven orders yet.
              </p>
            ) : (
              <div className="space-y-2">
                {topInviters.map((t) => (
                  <div
                    key={t.inviteCode}
                    className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="font-mono text-xs text-stone-500">
                        {t.inviteCode}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {t.joins} {t.joins === 1 ? "friend" : "friends"} joined
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Sponsor ads</h2>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setShowBulk((v) => !v)}
              >
                {showBulk ? "Hide bulk add" : "Bulk add"}
              </button>
            </div>
            <p className="mb-3 text-sm text-stone-500">
              Gold logos sit under the banner. Silver, bronze, and special
              mentions sit below the ticket form. The full list is also on the
              order page and each ticket. Arrows change the order inside a tier.
              A wide transparent PNG, about 600×200, matches these sizes.
            </p>

            {showBulk && (
              <form
                onSubmit={addSponsorsBulk}
                className="mb-4 space-y-3 rounded-xl border border-dashed border-stone-300 p-3 dark:border-stone-700"
              >
                <p className="text-sm font-medium">
                  Bulk add — many logos at once
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tier for all">
                    <select
                      className={inputCls}
                      value={bulkTier}
                      onChange={(e) => setBulkTier(e.target.value)}
                    >
                      {SPONSOR_TIERS.map((t) => (
                        <option key={t} value={t}>
                          {TIER_SINGULAR[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Website link for all (optional)">
                    <input
                      className={inputCls}
                      value={bulkLink}
                      onChange={(e) => setBulkLink(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </Field>
                </div>
                <Field label="Logo images (select many at once)">
                  <input
                    type="file"
                    name="bulkFiles"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="text-sm"
                  />
                </Field>
                <Field label="Names — one per line, matched to the files in order (optional)">
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={bulkNames}
                    onChange={(e) => setBulkNames(e.target.value)}
                    placeholder={"Acme Foods\nNorthwind Traders"}
                  />
                </Field>
                <p className="-mt-1 text-xs text-stone-500">
                  Leave a line blank to use the file name instead. Bulk upload
                  keeps each file as-is — use Edit on one sponsor to preview or
                  crop that logo.
                </p>
                <button className={btnSecondary} disabled={bulkBusy}>
                  {bulkBusy ? "Uploading…" : "Upload all"}
                </button>
              </form>
            )}

            <div className="mb-4 space-y-4">
              {sponsors.length === 0 && (
                <p className="text-sm text-stone-500">None yet.</p>
              )}
              {SPONSOR_TIERS.map((tier) => {
                const items = sponsors.filter((s) => s.tier === tier);
                if (items.length === 0) return null;
                return (
                  <div key={tier}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                      {TIER_LABELS[tier]} ({items.length})
                    </p>
                    <div className="space-y-2">
                      {items.map((s, index) =>
                        editingId === s.id ? (
                          <form
                            key={s.id}
                            onSubmit={(e) => saveSponsorEdit(e, s.id)}
                            className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Sponsor name">
                                <input
                                  className={inputCls}
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                />
                              </Field>
                              <Field label="Tier">
                                <select
                                  className={inputCls}
                                  value={editTier}
                                  onChange={(e) => setEditTier(e.target.value)}
                                >
                                  {SPONSOR_TIERS.map((t) => (
                                    <option key={t} value={t}>
                                      {TIER_SINGULAR[t]}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                            </div>
                            <Field label="Website link (optional)">
                              <input
                                className={inputCls}
                                value={editLink}
                                onChange={(e) => setEditLink(e.target.value)}
                                placeholder="https://example.com"
                              />
                            </Field>
                            <Field
                              label={
                                s.imageUrl
                                  ? "Replace logo (leave empty to keep current)"
                                  : "Add a logo (optional)"
                              }
                            >
                              <input
                                type="file"
                                name="editFile"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="text-sm"
                              />
                            </Field>
                            <div className="flex gap-2">
                              <button className={btnPrimary} disabled={editBusy}>
                                {editBusy ? "Saving…" : "Save changes"}
                              </button>
                              <button
                                type="button"
                                className={btnSecondary}
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-800"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {s.imageUrl ? (
                              <img
                                src={s.imageUrl}
                                alt={s.name}
                                className={`w-auto shrink-0 object-contain ${TIER_LOGO_CLASS[s.tier] || TIER_LOGO_CLASS.SILVER}`}
                              />
                            ) : (
                              <span className="shrink-0 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                                Text
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {s.name}
                              </p>
                              <p className="truncate text-xs text-stone-500">
                                👁 {s.impressions ?? 0} views · {s.clicks ?? 0} clicks
                              </p>
                              {s.linkUrl && (
                                <p className="truncate text-xs text-stone-500">
                                  {s.linkUrl}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              className={btnSecondary + " px-2 py-1 text-xs"}
                              disabled={index === 0}
                              onClick={() => moveSponsor(s.id, "up")}
                              aria-label="Move sponsor up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={btnSecondary + " px-2 py-1 text-xs"}
                              disabled={index === items.length - 1}
                              onClick={() => moveSponsor(s.id, "down")}
                              aria-label="Move sponsor down"
                            >
                              ↓
                            </button>
                            <select
                              className={inputCls}
                              value={s.tier}
                              onChange={(e) =>
                                setSponsorTier(s.id, e.target.value)
                              }
                              aria-label="Sponsor tier"
                            >
                              {SPONSOR_TIERS.map((t) => (
                                <option key={t} value={t}>
                                  {TIER_SINGULAR[t]}
                                </option>
                              ))}
                            </select>
                            <button
                              className={btnSecondary}
                              onClick={() => startEditSponsor(s)}
                            >
                              Edit
                            </button>
                            <button
                              className={btnDanger}
                              onClick={() => deleteSponsor(s.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              onSubmit={addSponsor}
              className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-800"
            >
              <p className="text-sm font-medium">Add one sponsor</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Sponsor name">
                  <input
                    className={inputCls}
                    value={spName}
                    onChange={(e) => setSpName(e.target.value)}
                    placeholder="Acme Foods"
                  />
                </Field>
                <Field label="Tier">
                  <select
                    className={inputCls}
                    value={spTier}
                    onChange={(e) => setSpTier(e.target.value)}
                  >
                    {SPONSOR_TIERS.map((t) => (
                      <option key={t} value={t}>
                        {TIER_SINGULAR[t]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Website link (optional)">
                <input
                  className={inputCls}
                  value={spLink}
                  onChange={(e) => setSpLink(e.target.value)}
                  placeholder="https://example.com"
                />
              </Field>
              <Field label="Logo (optional). Add sponsor saves it onto the public page.">
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
              {sponsorNote && (
                <p
                  className={
                    sponsorNote.ok
                      ? "text-sm text-emerald-700 dark:text-emerald-400"
                      : "text-sm text-red-700 dark:text-red-400"
                  }
                >
                  {sponsorNote.text}
                </p>
              )}
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Ticket types</h2>
            <div className="mb-4 space-y-2">
              {event.ticketTypes.length === 0 && (
                <p className="text-sm text-stone-500">
                  None yet — add at least one to sell.
                </p>
              )}
              {event.ticketTypes.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-800"
                >
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-stone-500">
                      {formatCents(t.priceCents, event.currency)} ·{" "}
                      {t.quantityTotal} seats
                      {t.includesMeal ? " · includes meal" : ""}
                      {t.description ? ` · ${t.description}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => deleteTicketType(t.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={addTicketType} className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-800">
              <Field label="Name">
                <input
                  className={inputCls}
                  value={ttName}
                  onChange={(e) => setTtName(e.target.value)}
                  placeholder="General admission"
                  required
                />
              </Field>
              <Field label="Short description (optional)">
                <input
                  className={inputCls}
                  value={ttDesc}
                  onChange={(e) => setTtDesc(e.target.value)}
                  placeholder="Shown under the pass name, e.g. Ages 12+"
                  maxLength={160}
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
            {mealError && (
              <div className="mb-3">
                <ErrorNote message={mealError} />
              </div>
            )}
            <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg bg-stone-50 p-3 dark:bg-stone-800/50">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={!!event.requireEntryBeforeFood}
                onChange={(e) =>
                  patch({ requireEntryBeforeFood: e.target.checked })
                }
              />
              <span>
                <span className="block text-sm font-medium">
                  Require entry scan before food is served
                </span>
                <span className="block text-xs text-stone-500">
                  Guests must be checked in at the door before the food line
                  will serve them.
                </span>
              </span>
            </label>
            <div className="mb-4 space-y-2">
              {event.mealOptions.length === 0 && (
                <p className="text-sm text-stone-500">
                  None yet — only needed if a ticket type includes a meal.
                </p>
              )}
              {event.mealOptions.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-800"
                >
                  <p className="text-sm font-medium">
                    {m.name}
                    {m.description ? (
                      <span className="ml-1 font-normal text-stone-500">
                        — {m.description}
                      </span>
                    ) : null}
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
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => deleteMeal(m.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={addMeal}
              className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-800"
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
                <input
                  className={inputCls + " min-w-0 flex-1"}
                  value={mealDesc}
                  onChange={(e) => setMealDesc(e.target.value)}
                  placeholder="Short note — e.g. Veg - NOG"
                  aria-label="Meal description"
                  maxLength={120}
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
                <p className="text-sm text-stone-500">
                  None yet — add timed entries like doors, dinner, performances.
                </p>
              )}
              {(event?.programItems || []).map((p, i, arr) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {p.timeLabel && (
                        <span className="mr-2 text-xs font-semibold text-stone-500">
                          {p.timeLabel}
                        </span>
                      )}
                      {p.title}
                    </p>
                    {p.description && (
                      <p className="truncate text-xs text-stone-500">{p.description}</p>
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
              className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-800"
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
      {crop && (
        <ImageCropDialog
          file={crop.file}
          aspect={
            crop.purpose === "logo" ? 1 : crop.purpose === "photo" ? 3 / 2 : crop.purpose === "banner" ? 2.5 : 3
          }
          outputWidth={
            crop.purpose === "logo" ? 512 : crop.purpose === "photo" ? 1200 : crop.purpose === "banner" ? 1600 : 600
          }
          title={
            crop.purpose === "logo"
              ? "Crop logo"
              : crop.purpose === "banner"
                ? "Crop banner"
                : crop.purpose === "photo"
                  ? "Crop photo"
                  : "Crop sponsor logo"
          }
          hint={
            crop.purpose === "logo"
              ? "Drag to position the mark. It is shown in a square beside the event title."
              : crop.purpose === "banner"
                ? "Drag to choose the wide frame buyers see. Keep the title in the center."
                : crop.purpose === "photo"
                  ? "Drag to choose the part that shows in the photo strip."
                  : "Drag to trim the logo to a wide frame, about 600×200."
          }
          onCancel={() => setCrop(null)}
          onConfirm={(file) => {
            const purpose = crop.purpose;
            setCrop(null);
            void applyCroppedFile(file, purpose);
          }}
        />
      )}
      {sponsorLogo && !crop && (
        <SponsorLogoDialog
          file={sponsorLogo.file}
          onCancel={() => setSponsorLogo(null)}
          onUse={() => {
            const pending = sponsorLogo;
            setSponsorLogo(null);
            if (pending.purpose === "sponsor-new") void postSponsor(pending.file);
            else if (editingId) void commitSponsorEdit(editingId, pending.file);
          }}
          onCrop={() => {
            const pending = sponsorLogo;
            setSponsorLogo(null);
            setCrop({ file: pending.file, purpose: pending.purpose });
          }}
        />
      )}
    </Container>
  );
}
