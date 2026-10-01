"use client";

import { btnSecondary } from "@/components/ui";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className={btnSecondary}>
      Print
    </button>
  );
}
