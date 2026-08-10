"use client";

import { btnSecondaryClass } from "@/components/ui";

/** Tombol cetak LPJ — mengingatkan orientasi landscape di dialog printer. */
export function LpjPrintButton({
  label = "Cetak / PDF",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`${btnSecondaryClass} print:hidden`}
      onClick={() => {
        // Beberapa browser mengingat orientasi terakhir; pastikan user cek Landscape.
        window.print();
      }}
      title="Di dialog cetak, pilih orientasi Landscape / Landscape bila masih potret"
    >
      {label}
    </button>
  );
}
