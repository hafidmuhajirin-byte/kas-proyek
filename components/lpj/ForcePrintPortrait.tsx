"use client";

import { useEffect } from "react";

const STYLE_ID = "lpj-force-print-portrait";

/** Paksa @page default A4 potret (kuitansi BKK). */
export function ForcePrintPortrait() {
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
    size: A4 portrait;
    margin: 10mm;
  }
}
`;
    return () => {
      el?.remove();
    };
  }, []);

  return null;
}
