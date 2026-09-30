"use client";

import { useState } from "react";
import Link from "next/link";
import { Container, Card, Field, inputCls, btnPrimary, ErrorNote } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong");
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
          <h1 className="mb-1 text-xl font-bold">Forgot your password?</h1>
          {done ? (
            <p className="text-sm text-stone-500">
              If an account exists for <strong>{email}</strong>, we've emailed
              you a reset link. It expires in 1 hour.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-stone-500">
                Enter your email and we'll send you a reset link.
              </p>
              <ErrorNote message={error} />
              <form onSubmit={submit} className="space-y-4">
                <Field label="Email">
                  <input
                    className={inputCls}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </Field>
                <button className={btnPrimary} disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
          <p className="mt-4 text-sm text-stone-500">
            <Link href="/login" className="underline">
              Back to sign in
            </Link>
          </p>
        </Card>
      </div>
    </Container>
  );
}
