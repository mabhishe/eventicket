import { Suspense } from "react";
import LoginForm from "./form";
import { publicSignupEnabled } from "@/lib/publicSignup";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm allowSignup={publicSignupEnabled()} />
    </Suspense>
  );
}
