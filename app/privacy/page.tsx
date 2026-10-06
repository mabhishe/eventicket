import type { Metadata } from "next";
import { Container, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy · EventPass",
  description: "How EventPass handles names, orders, and the public Who's going list.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-stone-900">
          Privacy Policy
        </h1>
        <Card>
          <div className="space-y-4 text-sm text-stone-600">
            <p>
              <strong className="text-stone-800">What we collect.</strong> When
              you order tickets we collect your name, email and/or phone
              number, your ticket and meal selections, and your chosen payment
              method. Organizers may also see your order reference and entry
              codes for check-in.
            </p>
            <p>
              <strong className="text-stone-800">How it&rsquo;s used.</strong>{" "}
              Your details are used to issue your passes, confirm payment,
              send event reminders, and check you in at the door. If you opt
              in at checkout, the public &ldquo;Who&rsquo;s going&rdquo; list
              shows only your first name, the initial of your last name, and
              your party size. You are left off that list unless you choose
              it. The organizer still sees the full name on the order.
            </p>
            <p>
              <strong className="text-stone-800">Who sees it.</strong> Your
              order details are shared with the event organizer. We do not sell
              your personal information or share it with advertisers.
            </p>
            <p>
              <strong className="text-stone-800">Messages.</strong> We may email
              or message you about your order (confirmation, payment reminders,
              event reminders). You can ask the organizer to remove your
              details after the event.
            </p>
            <p>
              <strong className="text-stone-800">Security.</strong> Access to
              order data is limited to the organizing team. Payments are made
              directly to organizers — EventPass never sees your banking
              credentials.
            </p>
            <p className="text-xs text-stone-400">
              Last updated October 2026.
            </p>
          </div>
        </Card>
      </div>
    </Container>
  );
}
