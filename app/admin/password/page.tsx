"use client";

import { useState } from "react";
import {
  Container,
  Card,
  PageTitle,
  Field,
  inputCls,
  btnPrimary,
  ErrorNote,
} from "@/components/ui";

export default function PasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not change password");
      return;
    }
    setDone(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <PageTitle title="Change password" />
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Current password">
              <input
                className={inputCls}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="New password (8+ characters)">
              <input
                className={inputCls}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </Field>
            <Field label="Confirm new password">
              <input
                className={inputCls}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </Field>
            <ErrorNote message={error} />
            {done && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Password changed.
              </p>
            )}
            <button className={btnPrimary + " w-full"} disabled={busy}>
              {busy ? "Saving…" : "Change password"}
            </button>
          </form>
        </Card>
      </div>
    </Container>
  );
}
