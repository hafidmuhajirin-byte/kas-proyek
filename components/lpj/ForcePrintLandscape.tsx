"use client";

import { useEffect } from "react";

const STYLE_ID = "lpj-force-print-landscape";

/**
 * Paksa @page default jadi A4 landscape saat halaman ini aktif.
 * Named CSS page (`page: lpj-export-landscape`) sering diabaikan browser
 * sehingga dialog Cetak/PDF jatuh ke potret.
 */
export function ForcePrintLandscape() {
  useEffect(() => {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = `
@media print {
  @page {
    size: A4 landscape;
    margin: 8mm;
  }
}
`;
    return () => {
      el?.remove();
    };
  }, []);

  return null;
}
