"use client";

import { btnSecondaryClass } from "@/components/ui";

export function PrintButton({ label = "Cetak pembukuan" }: { label?: string }) {
  return (
    <button
      type="button"
      className={`${btnSecondaryClass} print:hidden`}
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
