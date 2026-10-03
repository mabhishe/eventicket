import Link from "next/link";
import { Container, Card } from "@/components/ui";
import { publicSignupEnabled } from "@/lib/publicSignup";
import SignupForm from "./form";

export default function SignupPage() {
  if (!publicSignupEnabled()) {
    return (
      <Container>
        <div className="mx-auto max-w-md">
          <Card>
            <h1 className="mb-1 text-xl font-bold">Accounts are added by the organizer</h1>
            <p className="mb-4 text-sm text-stone-500">
              Public signup is turned off on this site. Door staff and other
              organizers get a login from Team. Guests do not need an account
              to buy tickets.
            </p>
            <Link href="/login" className="text-sm underline">
              Staff sign in
            </Link>
          </Card>
        </div>
      </Container>
    );
  }
  return <SignupForm />;
}
