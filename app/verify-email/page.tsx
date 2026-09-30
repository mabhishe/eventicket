"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Container, Card, btnPrimary } from "@/components/ui";

function Verify() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<"busy" | "ok" | "bad">("busy");

  useEffect(() => {
    const token = searchParams.get("token") || "";
    if (!token) {
      setState("bad");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => setState(res.ok ? "ok" : "bad"))
      .catch(() => setState("bad"));
  }, [searchParams]);

  return (
    <Container>
      <div className="mx-auto max-w-md">
        <Card>
          {state === "busy" && (
            <p className="text-sm text-zinc-500">Verifying your email…</p>
          )}
          {state === "ok" && (
            <>
              <h1 className="mb-1 text-xl font-bold">Email verified ✅</h1>
              <p className="mb-4 text-sm text-zinc-500">
                Your email is confirmed. You can now publish events.
              </p>
              <Link href="/admin" className={btnPrimary}>
                Go to your dashboard
              </Link>
            </>
          )}
          {state === "bad" && (
            <>
              <h1 className="mb-1 text-xl font-bold">Link didn't work</h1>
              <p className="mb-4 text-sm text-zinc-500">
                This verification link is invalid or has expired. Links last 24
                hours — ask for a new one from your dashboard, or sign up again.
              </p>
              <Link href="/login" className={btnPrimary}>
                Sign in
              </Link>
            </>
          )}
        </Card>
      </div>
    </Container>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
