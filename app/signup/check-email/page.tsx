import Link from "next/link";
import { Container, Card, btnSecondary } from "@/components/ui";

export default function CheckEmailPage() {
  return (
    <Container>
      <div className="mx-auto max-w-md">
        <Card>
          <h1 className="mb-1 text-xl font-bold">Check your email ✉️</h1>
          <p className="mb-4 text-sm text-zinc-500">
            We sent you a verification link. Click it to confirm your email —
            you'll need that before you can publish events.
          </p>
          <Link href="/admin" className={btnSecondary}>
            Continue to your dashboard
          </Link>
        </Card>
      </div>
    </Container>
  );
}
