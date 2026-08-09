/** Label kanonik untuk pagu / kategori jasa manajemen. */
export const LABEL_BAYAR_JASA_PERENCANAAN = "Bayar jasa perencana";
export const LABEL_BAYAR_JASA_PENGAWASAN = "Bayar jasa Pengawas";

/**
 * Ganti kata Perencanaan / Pengawasan di teks tampilan
 * menjadi "Bayar jasa perencana" / "Bayar jasa Pengawas".
 * Awalan "Penyerahan ke …" / "Penyerahn Ke …" dan sufiks "CV" dihapus
 * agar uraian hanya label jasa.
 */
export function rewriteJasaPerencanaanPengawasan(text: string): string {
  if (!text) return text;
  let s = text;
  // Lindungi / normalisasi frasa baru & lama → placeholder
  s = s.replace(/Bayar\s+jasa\s+perencana\b/gi, "\u0001");
  s = s.replace(/Bayar\s+jasa\s+Pengawas\b/gi, "\u0002");
  s = s.replace(/Bayar\s+Jasa\s+Perencanaan\b/gi, "\u0001");
  s = s.replace(/Bayar\s+jasa\s+Pengawasan\b/gi, "\u0002");
  // Frasa lama → baru
  s = s.replace(/Dana\s+Perencanaan/gi, "\u0001");
  s = s.replace(/Dana\s+Pengawasan/gi, "\u0002");
  // Kata lepas (setelah frasa "Bayar jasa …" dilindungi)
  s = s.replace(/Perencanaan/gi, "\u0001");
  s = s.replace(/Pengawasan/gi, "\u0002");

  const hasPerencana = s.includes("\u0001");
  const hasPengawas = s.includes("\u0002");
  s = s.replace(/\u0001/g, LABEL_BAYAR_JASA_PERENCANAAN);
  s = s.replace(/\u0002/g, LABEL_BAYAR_JASA_PENGAWASAN);

  if (hasPerencana || hasPengawas) {
    // "Penyerahan ke Bayar jasa …" / typo "Penyerahn Ke …" → cukup label jasa
    if (/penyerah/i.test(s)) {
      if (hasPengawas && !hasPerencana) return LABEL_BAYAR_JASA_PENGAWASAN;
      if (hasPerencana && !hasPengawas) return LABEL_BAYAR_JASA_PERENCANAAN;
    }
    s = s.replace(/^(penyerahan|penyerahn)\s+ke\s+/i, "");
    s = s.replace(/\s+CV\.?(?=\s|$)/gi, "");
    s = s.replace(/\bCV\.?\s*$/i, "");
  }

  return s.replace(/\s{2,}/g, " ").trim();
}
