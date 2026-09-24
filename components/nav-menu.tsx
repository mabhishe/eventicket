"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions";

export default function NavMenuClient({
  appName,
  links,
  signedIn,
}: {
  appName: string;
  links: { href: string; label: string }[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {appName}
        </Link>
        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 text-sm sm:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline">
              {l.label}
            </Link>
          ))}
          {signedIn && <LogoutForm desktop />}
        </nav>
        {/* Mobile hamburger */}
        <button
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold sm:hidden dark:border-zinc-700"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <nav className="border-t border-zinc-200 text-sm sm:hidden dark:border-zinc-800">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block border-b border-zinc-100 px-4 py-3 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {signedIn && (
            <div className="px-4 py-1">
              <LogoutForm />
            </div>
          )}
        </nav>
      )}
    </header>
  );
}

function LogoutForm({ desktop = false }: { desktop?: boolean }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={
          desktop
            ? "hover:underline"
            : "block w-full py-3 text-left hover:underline"
        }
      >
        Sign out
      </button>
    </form>
  );
}
