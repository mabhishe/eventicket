import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageTitle, Card } from "@/components/ui";
import { PLANS } from "@/lib/plans";
import { publicSignupEnabled } from "@/lib/publicSignup";

export const metadata: Metadata = {
  title: "Pricing · EventPass",
  description:
    "Start free. Request an organizer login, then upgrade when your events outgrow the free tier.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing · EventPass",
    description:
      "Start free. Request an organizer login from the EventPass team.",
    url: "/pricing",
    siteName: "EventPass",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Pricing · EventPass",
    description:
      "Start free. Request an organizer login from the EventPass team.",
  },
};

// Where early-access requests go.
const EARLY_ACCESS_EMAIL = "info@aicloudconsult.com";

const FREE_FEATURES = [
  "1 published event at a time",
  "200 bookings per month",
  "400 emails per month",
  "2 team seats",
  "QR tickets, door check-in, food collection",
  "Sponsor ads + social share cards",
];

const PRO_FEATURES = [
  "Unlimited events, bookings & team seats",
  "No EventPass badge on public pages",
  "Waitlists",
  "WhatsApp notifications",
  "Broadcast + reminder messages",
  "Custom email templates",
  "Accent color & branding",
  "CSV exports + advanced reports",
  "Everything in Free",
];

export default function PricingPage() {
  const monthly = `$${(PLANS.PRO.priceCents / 100).toFixed(0)}`;
  const signupOpen = publicSignupEnabled();
  return (
    <Container>
      <PageTitle
        title="Simple pricing"
        sub="Start free. Upgrade when your community outgrows it."
      />
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Free</h2>
          <p className="mt-1 text-3xl font-extrabold">
            $0
            <span className="text-sm font-normal text-stone-500"> CAD / forever</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden>✓</span> {f}
              </li>
            ))}
          </ul>
          {signupOpen ? (
            <Link
              href="/signup"
              className="mt-6 inline-block rounded-lg border border-stone-300 px-4 py-2 font-semibold dark:border-stone-700"
            >
              Start free
            </Link>
          ) : (
            <>
              <a
                href="mailto:info@aicloudconsult.com?subject=EventPass%20organizer%20access"
                className="mt-6 inline-block rounded-lg bg-orange-700 px-4 py-2 font-semibold text-white hover:bg-orange-800"
              >
                Request access
              </a>
              <p className="mt-3 text-sm text-stone-500">
                Email{" "}
                <a
                  href="mailto:info@aicloudconsult.com"
                  className="font-medium underline"
                >
                  info@aicloudconsult.com
                </a>{" "}
                and the team will set up your organizer login.
              </p>
            </>
          )}
        </Card>
        <Card className="border-2 !border-orange-500 shadow-[0_8px_30px_rgba(234,88,12,0.15)]">
          <h2 className="text-lg font-bold">
            Pro{" "}
            <span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-200">
              Coming soon
            </span>
          </h2>
          <p className="mt-1 text-3xl font-extrabold">
            {monthly}
            <span className="text-sm font-normal text-stone-500">
              {" "}
              CAD / month
            </span>
          </p>
          <p className="mt-1 text-sm text-stone-500">
            or $290 CAD / year — two months free
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden>✓</span> {f}
              </li>
            ))}
          </ul>
          <a
            href={`mailto:${EARLY_ACCESS_EMAIL}?subject=${encodeURIComponent(
              "EventPass Pro early access"
            )}`}
            className="mt-6 inline-block rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700"
          >
            Contact for early access
          </a>
          <p className="mt-3 text-sm text-stone-500">
            Pro launches soon — write to us and we&apos;ll set you up first.
          </p>
        </Card>
      </div>
      <div className="mx-auto mt-8 max-w-3xl space-y-1 text-center text-xs text-stone-500">
        <p>
          No per-ticket fees on either plan. You collect payments directly — we
          never take a cut.
        </p>
        <p>
          Free includes 200 bookings and 400 emails per calendar month per
          organization. A booking is one order, however many tickets it holds.
        </p>
        <p>
          Pro includes up to 1,000 WhatsApp notifications per month per
          organization (fair use). One free organization per account.
        </p>
      </div>
    </Container>
  );
}
