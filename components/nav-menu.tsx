"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions";
import OrgSwitcher from "@/components/org-switcher";

export default function NavMenuClient({
  appName,
  companyName,
  links,
  signedIn,
}: {
  appName: string;
  companyName: string;
  links: { href: string; label: string }[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#faf6ef]/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="text-orange-700 dark:text-orange-500"
          >
            <path
              d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M13 5v2m0 3v2m0 3v2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeDasharray="2 2"
            />
          </svg>
          <span className="leading-none">
            <span className="block text-lg font-bold tracking-tight">{appName}</span>
            <span className="mt-0.5 block text-[11px] font-medium tracking-normal text-stone-500 dark:text-stone-400">
              by {companyName}
            </span>
          </span>
        </Link>
        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 text-sm sm:flex">
          {signedIn && <OrgSwitcher />}
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-stone-600 transition hover:text-orange-700 dark:text-stone-300 dark:hover:text-orange-400"
            >
              {l.label}
            </Link>
          ))}
          {signedIn && <LogoutForm desktop />}
        </nav>
        {/* Mobile hamburger */}
        <button
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold sm:hidden dark:border-stone-700"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <nav className="border-t border-stone-200 text-sm sm:hidden dark:border-stone-800">
          {signedIn && (
            <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
              <OrgSwitcher />
            </div>
          )}
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block border-b border-stone-100 px-4 py-3 hover:bg-stone-100 dark:border-stone-800 dark:hover:bg-stone-900"
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
