import Link from "next/link";
import { Container, PageTitle, Card } from "@/components/ui";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Pricing — EventPass" };

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
  "No EventPass badge on public pages",
  "Everything in Free",
];

export default function PricingPage() {
  const price = `$${(PLANS.PRO.priceCents / 100).toFixed(0)}`;
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
            <span className="text-sm font-normal text-zinc-500"> / forever</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden>✓</span> {f}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-lg border border-zinc-300 px-4 py-2 font-semibold dark:border-zinc-700"
          >
            Start free
          </Link>
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
            <span className="text-sm font-normal text-zinc-500">
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
          <p className="mt-6 text-sm text-zinc-500">
            Pro launches soon — start free today, upgrade when it&apos;s here.
          </p>
          <Link
            href="/signup"
            className="mt-2 inline-block rounded-lg border border-zinc-300 px-4 py-2 font-semibold dark:border-zinc-700"
          >
            Start free
          </Link>
        </Card>
      </div>
    </Container>
  );
}
