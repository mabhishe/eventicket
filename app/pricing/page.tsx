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

const FREE_FEATURES = [
  "1 published event at a time",
  "Up to 500 tickets per event",
  "2 team seats",
  "QR tickets, door check-in, food collection",
  "Sponsor ads + social share cards",
];

const PRO_FEATURES = [
  "Unlimited published events",
  "Unlimited tickets per event",
  "Unlimited team seats",
  "Your branding on the public event page",
  "Everything in Free",
];

export default function PricingPage() {
  const price = `$${(PLANS.PRO.priceCents / 100).toFixed(0)}`;
  const signupOpen = publicSignupEnabled();
  return (
    <Container>
      <PageTitle
        title="Simple pricing"
        sub="Start free. Upgrade when your events outgrow the free tier."
      />
      <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
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
        <Card>
          <h2 className="text-lg font-bold">
            Pro{" "}
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Coming soon
            </span>
          </h2>
          <p className="mt-1 text-3xl font-extrabold">
            {price}
            <span className="text-sm font-normal text-stone-500">
              {" "}
              CAD / month
            </span>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden>✓</span> {f}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-stone-500">
            {signupOpen
              ? "Pro launches soon — start free today, upgrade when it's here."
              : "Pro launches soon. Request access and the team will be in touch."}
          </p>
        </Card>
      </div>
    </Container>
  );
}
