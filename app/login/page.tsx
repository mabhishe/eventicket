"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Container, Card, Field, inputCls, btnPrimary, ErrorNote } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "forbidden"
      ? "Your account does not have access to that area."
      : null
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Sign in failed");
      setBusy(false);
      return;
    }
    const role = data.user.role as string;
    router.push(role === "DOOR" ? "/door" : "/admin");
    router.refresh();
  }

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <Card>
          <h1 className="mb-1 text-xl font-bold">Staff sign in</h1>
          <p className="mb-4 text-sm text-zinc-500">
            Organizers, sellers, and door staff sign in here.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <input
                className={inputCls}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <input
                className={inputCls}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <ErrorNote message={error} />
            <button className={btnPrimary + " w-full"} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </Card>
      </div>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
