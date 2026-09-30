"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container, Card, Field, inputCls, btnPrimary, ErrorNote } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, orgName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed");
        setBusy(false);
        return;
      }
      if (data.user.emailVerified) {
        router.push("/admin");
      } else {
        router.push("/signup/check-email");
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <Card>
          <h1 className="mb-1 text-xl font-bold">Create your account</h1>
          <p className="mb-4 text-sm text-zinc-500">
            Start selling tickets for your events in minutes. Free to start.
          </p>
          <ErrorNote message={error} />
          <form onSubmit={submit} className="space-y-4">
            <Field label="Your name">
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </Field>
            <Field label="Organization name">
              <input
                className={inputCls}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Mississauga Tamil Sangam"
                autoComplete="organization"
                required
              />
            </Field>
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
            <Field label="Password (8+ characters)">
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
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </Container>
  );
}
