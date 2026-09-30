"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
  ErrorNote,
} from "@/components/ui";

type TemplateChannel = {
  channel: string;
  subject: string;
  body: string;
  custom: boolean;
  templateName?: string | null;
  bodyParams?: string[] | null;
};
type TemplateDef = {
  key: string;
  label: string;
  description: string;
  channels: TemplateChannel[];
};
type Reminder = {
  id: string;
  offsetMinutes: number;
  channel: string;
  enabled: boolean;
  event: { id: string; title: string; date: string; slug: string };
};
type EventOption = { id: string; title: string; date: string };

function fmtOffset(min: number): string {
  if (min % 1440 === 0) return `${min / 1440} day${min === 1440 ? "" : "s"}`;
  if (min % 60 === 0) return `${min / 60} hour${min === 60 ? "" : "s"}`;
  return `${min} minutes`;
}

export default function MessagesPage() {
  const [defs, setDefs] = useState<TemplateDef[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [selKey, setSelKey] = useState("");
  const [selChannel, setSelChannel] = useState("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [waName, setWaName] = useState("");
  const [waParams, setWaParams] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");

  const [events, setEvents] = useState<EventOption[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remEvent, setRemEvent] = useState("");
  const [remNum, setRemNum] = useState("1");
  const [remUnit, setRemUnit] = useState("days");
  const [remChannel, setRemChannel] = useState("EMAIL");
  const [remBusy, setRemBusy] = useState(false);

  const [bcEvent, setBcEvent] = useState("");
  const [bcSubject, setBcSubject] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [bcBusy, setBcBusy] = useState(false);
  const [bcResult, setBcResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/admin/messages/templates");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load templates");
      return;
    }
    setDefs(data.templates);
    setVariables(data.variables || []);
    if (!selKey && data.templates.length > 0) setSelKey(data.templates[0].key);
  }, [selKey]);

  const loadReminders = useCallback(async () => {
    const res = await fetch("/api/admin/messages/reminders");
    const data = await res.json();
    if (res.ok) setReminders(data.reminders || []);
  }, []);

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/admin/events");
    const data = await res.json();
    if (res.ok) {
      const upcoming = (data.events || [])
        .filter((e: EventOption) => new Date(e.date).getTime() > Date.now() - 86400000)
        .map((e: EventOption) => ({ id: e.id, title: e.title, date: e.date }));
      setEvents(upcoming);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadReminders();
    loadEvents();
  }, [loadTemplates, loadReminders, loadEvents]);

  // Fill the editor when the selected template/channel changes.
  useEffect(() => {
    const def = defs.find((d) => d.key === selKey);
    const ch = def?.channels.find((c) => c.channel === selChannel);
    if (ch) {
      setSubject(ch.subject);
      setBody(ch.body);
      setWaName(ch.templateName || "");
      setWaParams((ch.bodyParams || []).join("\n"));
      setIsCustom(ch.custom);
    } else if (def) {
      const first = def.channels[0];
      setSelChannel(first.channel);
    }
    setTplMsg(null);
  }, [defs, selKey, selChannel]);

  const saveTemplate = async () => {
    setTplBusy(true);
    setTplMsg(null);
    const res = await fetch("/api/admin/messages/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: selKey,
        channel: selChannel,
        subject: selChannel === "EMAIL" ? subject : null,
        body,
        templateName: selChannel === "WHATSAPP" ? waName : null,
        bodyParams:
          selChannel === "WHATSAPP"
            ? waParams.split("\n").map((s) => s.trim()).filter(Boolean)
            : null,
      }),
    });
    const data = await res.json();
    setTplBusy(false);
    if (!res.ok) {
      setTplMsg(data.error || "Could not save");
      return;
    }
    setTplMsg("Saved ✓");
    loadTemplates();
  };

  const resetTemplate = async () => {
    if (!confirm("Reset this template to the built-in default?")) return;
    setTplBusy(true);
    const res = await fetch(
      `/api/admin/messages/templates?key=${encodeURIComponent(selKey)}&channel=${selChannel}`,
      { method: "DELETE" }
    );
    setTplBusy(false);
    if (res.ok) {
      setTplMsg("Reset to default ✓");
      loadTemplates();
    }
  };

  const sendTest = async () => {
    setTplBusy(true);
    setTplMsg(null);
    const res = await fetch("/api/admin/messages/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: selKey, channel: selChannel, phone: testPhone }),
    });
    const data = await res.json();
    setTplBusy(false);
    setTplMsg(
      res.ok
        ? data.sent
          ? `Test sent to ${data.to} ✓`
          : `Not sent — ${selChannel === "EMAIL" ? "email" : "WhatsApp"} is not configured on the server.`
        : data.error || "Test failed"
    );
  };

  const addReminder = async () => {
    const num = Math.floor(Number(remNum));
    if (!remEvent || !Number.isFinite(num) || num < 1) return;
    const offsetMinutes = remUnit === "days" ? num * 1440 : remUnit === "hours" ? num * 60 : num;
    setRemBusy(true);
    const res = await fetch("/api/admin/messages/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: remEvent, offsetMinutes, channel: remChannel }),
    });
    const data = await res.json();
    setRemBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add reminder");
      return;
    }
    setRemEvent("");
    loadReminders();
  };

  const deleteReminder = async (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    await fetch(`/api/admin/messages/reminders/${id}`, { method: "DELETE" });
    loadReminders();
  };

  const sendBroadcast = async () => {
    if (!bcEvent || !bcSubject.trim() || !bcBody.trim()) return;
    if (
      !confirm(
        "Send this email to every buyer with a confirmed order for this event? This cannot be undone."
      )
    )
      return;
    setBcBusy(true);
    setBcResult(null);
    const res = await fetch("/api/admin/messages/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: bcEvent, subject: bcSubject, body: bcBody }),
    });
    const data = await res.json();
    setBcBusy(false);
    setBcResult(
      res.ok
        ? `Sent to ${data.sent} buyer${data.sent === 1 ? "" : "s"}${data.skipped ? ` (${data.skipped} skipped)` : ""}.`
        : data.error || "Broadcast failed"
    );
  };

  const selDef = defs.find((d) => d.key === selKey);
  const selChannels = selDef?.channels.map((c) => c.channel) || [];

  return (
    <Container>
      <PageTitle
        title="Messages"
        sub="Email templates, event reminders, and mass messages for your organization."
      />
      <ErrorNote message={error} />

      <Card className="mb-6">
        <h2 className="mb-1 text-lg font-bold text-stone-900">Message templates</h2>
        <p className="mb-4 text-sm text-stone-500">
          Customize what buyers receive. Use {"{{variables}}"} — they fill in automatically per
          buyer. WhatsApp needs a pre-approved Meta template name; until then the built-in
          WhatsApp messages keep working.
        </p>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="Which message">
            <select
              className={inputCls}
              value={selKey}
              onChange={(e) => setSelKey(e.target.value)}
            >
              {defs.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <span className="mb-1 block text-sm font-medium text-stone-700">Channel</span>
            <div className="flex gap-2">
              {selChannels.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelChannel(c)}
                  className={
                    selChannel === c
                      ? "rounded-full bg-orange-700 px-4 py-1.5 text-sm font-semibold text-white"
                      : "rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-600"
                  }
                >
                  {c === "EMAIL" ? "Email" : "WhatsApp"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {selDef && (
          <p className="mb-4 text-sm text-stone-500">{selDef.description}</p>
        )}
        {selChannel === "EMAIL" && (
          <div className="mb-3">
            <Field label="Subject">
              <input
                className={inputCls}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </Field>
          </div>
        )}
        {selChannel === "WHATSAPP" && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Field label="Meta template name">
                <input
                  className={inputCls}
                  value={waName}
                  onChange={(e) => setWaName(e.target.value)}
                  placeholder="eventpass_reminder"
                  maxLength={100}
                />
              </Field>
              <p className="mt-1 text-xs text-stone-400">
                The approved template in your WhatsApp Business account.
              </p>
            </div>
            <div>
              <Field label="Template parameters">
                <textarea
                  className={inputCls}
                  rows={3}
                  value={waParams}
                  onChange={(e) => setWaParams(e.target.value)}
                  placeholder={"{{buyer.name}}\n{{event.title}}\n{{event.date}}"}
                />
              </Field>
              <p className="mt-1 text-xs text-stone-400">
                One {"{{variable}}"} per line, in order — fills {"{{1}}"}, {"{{2}}"}… of the Meta template.
              </p>
            </div>
          </div>
        )}
        <Field label={selChannel === "EMAIL" ? "Email body (HTML allowed)" : "Notes (not sent — WhatsApp uses the Meta template above)"}>
          <textarea
            className={`${inputCls} font-mono text-sm`}
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setBody((b) => b + v)}
              className="rounded-full bg-orange-50 px-2.5 py-1 font-mono text-xs text-orange-800 hover:bg-orange-100"
              title="Insert into body"
            >
              {v}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className={btnPrimary} disabled={tplBusy} onClick={saveTemplate}>
            {tplBusy ? "Saving…" : "Save template"}
          </button>
          {isCustom && (
            <button className={btnSecondary} disabled={tplBusy} onClick={resetTemplate}>
              Reset to default
            </button>
          )}
          <span className="text-sm text-stone-400">
            {isCustom ? "Customized" : "Using built-in default"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
          {selChannel === "WHATSAPP" && (
            <input
              className={inputCls}
              style={{ maxWidth: 220 }}
              placeholder="Test phone, e.g. 416-555-1234"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          )}
          <button className={btnSecondary} disabled={tplBusy} onClick={sendTest}>
            {tplBusy ? "Sending…" : selChannel === "EMAIL" ? "Send test email" : "Send test WhatsApp"}
          </button>
          {tplMsg && <span className="text-sm text-stone-600">{tplMsg}</span>}
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 text-lg font-bold text-stone-900">Scheduled reminders</h2>
        <p className="mb-4 text-sm text-stone-500">
          Remind ticket holders before the event. Each rule fires once per buyer with a confirmed
          order.
        </p>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_120px_140px_140px_auto]">
          <Field label="Event">
            <select className={inputCls} value={remEvent} onChange={(e) => setRemEvent(e.target.value)}>
              <option value="">Choose an event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Number">
            <input
              className={inputCls}
              type="number"
              min={1}
              value={remNum}
              onChange={(e) => setRemNum(e.target.value)}
            />
          </Field>
          <Field label="Unit">
            <select className={inputCls} value={remUnit} onChange={(e) => setRemUnit(e.target.value)}>
              <option value="days">days</option>
              <option value="hours">hours</option>
              <option value="minutes">minutes</option>
            </select>
          </Field>
          <Field label="Send as">
            <select
              className={inputCls}
              value={remChannel}
              onChange={(e) => setRemChannel(e.target.value)}
            >
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button className={btnPrimary} disabled={remBusy || !remEvent} onClick={addReminder}>
              Add reminder
            </button>
          </div>
        </div>
        {reminders.length === 0 ? (
          <p className="text-sm text-stone-400">No reminders scheduled yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <div className="text-sm">
                  <span className="font-semibold text-stone-800">{r.event.title}</span>
                  <span className="text-stone-500">
                    {" "}
                    — {r.channel === "EMAIL" ? "email" : "WhatsApp"}, {fmtOffset(r.offsetMinutes)}{" "}
                    before
                  </span>
                </div>
                <button
                  className="text-sm font-medium text-red-600 hover:underline"
                  onClick={() => deleteReminder(r.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-bold text-stone-900">Mass message</h2>
        <p className="mb-4 text-sm text-stone-500">
          One email to every buyer with a confirmed order for an event. Personalized per buyer
          with {"{{variables}}"}. Limited to 3 per hour.
        </p>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Field label="Event">
            <select className={inputCls} value={bcEvent} onChange={(e) => setBcEvent(e.target.value)}>
              <option value="">Choose an event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <input
              className={inputCls}
              value={bcSubject}
              onChange={(e) => setBcSubject(e.target.value)}
              maxLength={200}
              placeholder="e.g. Parking info for {{event.title}}"
            />
          </Field>
        </div>
        <Field label="Message (HTML allowed)">
          <textarea
            className={`${inputCls} font-mono text-sm`}
            rows={6}
            value={bcBody}
            onChange={(e) => setBcBody(e.target.value)}
            placeholder={"<p>Hi {{buyer.name}},</p>\n<p>…</p>"}
          />
        </Field>
        <div className="mt-4 flex items-center gap-3">
          <button className={btnDanger} disabled={bcBusy} onClick={sendBroadcast}>
            {bcBusy ? "Sending…" : "Send to all confirmed buyers"}
          </button>
          {bcResult && <span className="text-sm text-stone-600">{bcResult}</span>}
        </div>
      </Card>
    </Container>
  );
}
