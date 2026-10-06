import type { Metadata } from "next";
import Link from "next/link";
import { Container, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found · EventPass",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Container>
      <div className="mx-auto max-w-md">
        <Card>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-50">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            That link does not match a page on EventPass.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block font-semibold text-orange-800 underline dark:text-orange-400"
          >
            Back to events
          </Link>
        </Card>
      </div>
    </Container>
  );
}
