import { rewriteJasaPerencanaanPengawasan } from "@/lib/lpj/jasa-labels";

const KEEP_UPPER = new Set([
  "TK",
  "SD",
  "SMP",
  "SMA",
  "SMK",
  "NU",
  "PGRI",
  "CV",
  "PT",
  "RT",
  "RW",
]);

/**
 * Seragamkan kapitalisasi tampilan per kata (Title Case).
 * Singkatan umum (TK, NU, PGRI, dll.) tetap kapital penuh.
 * Juga menormalisasi label Perencanaan/Pengawasan → Bayar Jasa …
 */
export function tidyCase(value: string): string {
  const text = value.trim();
  if (!text) return text;

  const titled = text
    .split(/(\s+|-+|\/+)/)
    .map((part) => {
      if (!part || /^[\s\-/]+$/.test(part)) return part;

      const match = part.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
      if (!match) return part;

      const [, prefix, core, suffix] = match;
      const upper = core.toUpperCase();

      if (KEEP_UPPER.has(upper)) {
        return `${prefix}${upper}${suffix}`;
      }

      const word = upper.charAt(0) + upper.slice(1).toLowerCase();
      return `${prefix}${word}${suffix}`;
    })
    .join("");

  return rewriteJasaPerencanaanPengawasan(titled);
}
