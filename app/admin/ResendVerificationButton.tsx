"use client";

import { useState } from "react";

/** "Resend email" button for the unverified-email banner on /admin. */
export default function ResendVerificationButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  async function resend() {
    if (state === "sending") return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Couldn't send the email.");
      }
      setState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the email.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
        Sent — check your inbox (and spam folder).
      </span>
    );
  }

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        onClick={resend}
        disabled={state === "sending"}
        className="underline underline-offset-2 hover:no-underline disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Resend email"}
      </button>
      {state === "error" && (
        <span className="font-medium text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
    </span>
  );
}
