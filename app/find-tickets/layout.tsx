import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find tickets · EventPass",
  description: "Look up an EventPass order with the name and email or phone used at checkout.",
  alternates: { canonical: "/find-tickets" },
  robots: { index: false, follow: false },
};

export default function FindTicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
