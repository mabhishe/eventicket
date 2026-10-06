import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./form";
import { publicSignupEnabled } from "@/lib/publicSignup";

export const metadata: Metadata = {
  title: "Sign in · EventPass",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm allowSignup={publicSignupEnabled()} />
    </Suspense>
  );
}
