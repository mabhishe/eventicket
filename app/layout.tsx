import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSession, resolveActiveMembership } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform";
import { db } from "@/lib/db";
import NavMenuClient from "@/components/nav-menu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: process.env.APP_NAME || "EventPass",
  description: "Community event ticketing — sell tickets, check guests in.",
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
    links.push({ href: "/signup", label: "Create account" });
  }
  return <NavMenuClient appName={appName} links={links} signedIn={!!session} />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full text-stone-900 antialiased dark:text-stone-100">
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-stone-200/70 py-5 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
            {process.env.APP_NAME || "EventPass"} — made for community
            gatherings ·{" "}
            <a href="/pricing" className="font-medium underline decoration-orange-700/40 underline-offset-2 hover:text-orange-700">
              Pricing
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
