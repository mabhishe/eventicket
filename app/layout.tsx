import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSession, resolveActiveMembership } from "@/lib/auth";
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
    if (manager) links.push({ href: "/admin/settings", label: "Settings" });
    links.push({ href: "/admin/password", label: "Password" });
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
      <body className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
            {process.env.APP_NAME || "EventPass"} — community event ticketing ·{" "}
            <a href="/pricing" className="underline">
              Pricing
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
