"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Container, Card, Field, inputCls, btnPrimary, ErrorNote } from "@/components/ui";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not reset password");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <Card>
          <h1 className="mb-1 text-xl font-bold">Choose a new password</h1>
          {done ? (
            <>
              <p className="mb-4 text-sm text-stone-500">
                Your password has been updated. Sign in with your new password.
              </p>
              <Link href="/login" className={btnPrimary}>
                Sign in
              </Link>
            </>
          ) : !token ? (
            <p className="text-sm text-stone-500">
              This reset link is missing its token. Please use the link from
              your email.
            </p>
          ) : (
            <>
              <ErrorNote message={error} />
              <form onSubmit={submit} className="space-y-4">
                <Field label="New password (8+ characters)">
                  <input
                    className={inputCls}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                <button className={btnPrimary} disabled={busy}>
                  {busy ? "Saving…" : "Set new password"}
                </button>
              </form>
            </>
          )}
        </Card>
      </div>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
