import type { Metadata } from "next";
import Link from "next/link";
import { Container, Card } from "@/components/ui";
import { COMPANY_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact · EventPass",
  description:
    "EventPass is community ticketing by AiCloudConsult. Request organizer access or ask about an order.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          Contact
        </h1>
        <Card>
          <div className="space-y-4 text-sm text-stone-600 dark:text-stone-300">
            <p>
              EventPass is community ticketing from{" "}
              <a
                href="https://aicloudconsult.com"
                className="font-medium text-orange-800 underline dark:text-orange-400"
              >
                {COMPANY_NAME}
              </a>
              . Organizers publish an event page, guests pay the organizer
              directly, and door staff check people in with a phone.
            </p>
            <p>
              <strong className="text-stone-800 dark:text-stone-100">
                Run an event.
              </strong>{" "}
              New organizer logins are opened by the team. Email{" "}
              <a
                href="mailto:info@aicloudconsult.com?subject=EventPass%20organizer%20access"
                className="font-medium underline"
              >
                info@aicloudconsult.com
              </a>{" "}
              or see{" "}
              <Link href="/pricing" className="font-medium underline">
                pricing
              </Link>
              .
            </p>
            <p>
              <strong className="text-stone-800 dark:text-stone-100">
                Already ordered.
              </strong>{" "}
              Payment and entry questions go to the organizer of that event.
              You can also{" "}
              <Link href="/find-tickets" className="font-medium underline">
                find your tickets
              </Link>{" "}
              with the name and email or phone from checkout.
            </p>
          </div>
        </Card>
      </div>
    </Container>
  );
}
