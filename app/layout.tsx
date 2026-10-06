import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteOrigin } from "@/lib/site";
import { getSession, resolveActiveMembership } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform";
import { db } from "@/lib/db";
import NavMenuClient from "@/components/nav-menu";
import { COMPANY_NAME } from "@/lib/brand";
import { publicSignupEnabled } from "@/lib/publicSignup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: process.env.APP_NAME || "EventPass",
  description:
    "Community event ticketing. Guests pay the organizer directly — e-Transfer and more.",
};

async function Nav() {
  const session = await getSession();
  const appName = process.env.APP_NAME || "EventPass";
  const links: { href: string; label: string }[] = [];
  if (session) {
    const membership = await resolveActiveMembership(session.userId);
    const orgRole = membership?.role;
    const staff =
      orgRole === "ORG_OWNER" ||
      orgRole === "ORG_ADMIN" ||
      orgRole === "ORG_STAFF";
    const door =
      orgRole === "ORG_OWNER" ||
      orgRole === "ORG_ADMIN" ||
      orgRole === "ORG_DOOR";
    const manager = orgRole === "ORG_OWNER" || orgRole === "ORG_ADMIN";
    if (staff) links.push({ href: "/admin", label: "Organizer" });
    if (door) links.push({ href: "/door", label: "Door" });
    if (manager) links.push({ href: "/admin/reports", label: "Reports" });
    if (manager) links.push({ href: "/admin/messages", label: "Messages" });
    if (manager) links.push({ href: "/admin/users", label: "Team" });
    if (manager) links.push({ href: "/admin/settings", label: "Settings" });
    links.push({ href: "/admin/password", label: "Password" });
    // Platform admins (EventPass operators) get the cross-org admin panel.
    const me = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    if (isPlatformAdmin(me?.email)) {
      links.push({ href: "/admin/platform", label: "Platform" });
    }
  } else {
    links.push({ href: "/login", label: "Sign in" });
    if (publicSignupEnabled()) {
      links.push({ href: "/signup", label: "Create account" });
    }
  }
  return (
    <NavMenuClient
      appName={appName}
      companyName={COMPANY_NAME}
      links={links}
      signedIn={!!session}
    />
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce CSP is applied per request. Dynamic rendering lets Next attach it.
  await connection();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full text-stone-900 antialiased dark:text-stone-100">
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-stone-200/70 px-4 py-5 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <p>
              {process.env.APP_NAME || "EventPass"} by{" "}
              <a
                href="https://aicloudconsult.com"
                className="font-medium underline decoration-orange-700/40 underline-offset-2 hover:text-orange-700"
              >
                {COMPANY_NAME}
              </a>{" "}
              — made for community gatherings
            </p>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link href="/pricing" className="font-medium underline decoration-orange-700/40 underline-offset-2 hover:text-orange-700">
                Pricing
              </Link>
              <Link href="/privacy" className="font-medium underline decoration-orange-700/40 underline-offset-2 hover:text-orange-700">
                Privacy
              </Link>
              <Link href="/terms" className="font-medium underline decoration-orange-700/40 underline-offset-2 hover:text-orange-700">
                Terms
              </Link>
              <Link href="/contact" className="font-medium underline decoration-orange-700/40 underline-offset-2 hover:text-orange-700">
                Contact
              </Link>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
