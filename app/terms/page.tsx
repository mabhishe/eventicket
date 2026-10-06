import type { Metadata } from "next";
import { Container, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Terms · EventPass",
  description: "Terms for ordering passes and paying an event organizer directly.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-stone-900">
          Terms of Service
        </h1>
        <Card>
          <div className="space-y-4 text-sm text-stone-600">
            <p>
              EventPass is a ticketing platform operated for community event
              organizers. By placing an order through EventPass you agree to the
              following:
            </p>
            <p>
              <strong className="text-stone-800">1. Payments go to the organizer.</strong>{" "}
              EventPass does not process or hold your payment. When you choose
              Interac e-Transfer, Zelle, or cash, you pay the event organizer
              directly using the details shown at checkout. EventPass is not a
              party to that transaction and cannot refund it.
            </p>
            <p>
              <strong className="text-stone-800">2. Tickets are issued on payment confirmation.</strong>{" "}
              Your tickets and entry codes are issued after the organizer
              confirms your payment. If you believe you paid but have not
              received tickets, contact the organizer using the support details
              on the event page.
            </p>
            <p>
              <strong className="text-stone-800">3. Event changes and refunds.</strong>{" "}
              Refund, cancellation, and event-change policies are set by each
              organizer, not by EventPass.
            </p>
            <p>
              <strong className="text-stone-800">4. Your details.</strong> The
              name, email, and phone number you provide are shared with the
              event organizer so they can manage entry and contact you about
              the event.
            </p>
            <p>
              <strong className="text-stone-800">5. Acceptable use.</strong> Do
              not place fraudulent orders, attempt to check in with someone
              else&rsquo;s codes, or misuse the service.
            </p>
            <p className="text-xs text-stone-400">
              Last updated September 2026.
            </p>
          </div>
        </Card>
      </div>
    </Container>
  );
}
