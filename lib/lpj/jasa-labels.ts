/** Label kanonik untuk pagu / kategori jasa manajemen. */
export const LABEL_BAYAR_JASA_PERENCANAAN = "Bayar Jasa Perencanaan";
export const LABEL_BAYAR_JASA_PENGAWASAN = "Bayar jasa Pengawasan";

/**
 * Ganti kata Perencanaan / Pengawasan di teks tampilan
 * menjadi "Bayar Jasa Perencanaan" / "Bayar jasa Pengawasan".
 * Aman dipanggil berulang (tidak mendobel jika sudah diganti).
 */
export function rewriteJasaPerencanaanPengawasan(text: string): string {
  if (!text) return text;
  let s = text;
  // Lindungi frasa yang sudah benar
  s = s.replace(/Bayar\s+Jasa\s+Perencanaan/gi, "\u0001");
  s = s.replace(/Bayar\s+jasa\s+Pengawasan/gi, "\u0002");
  // Frasa lama → baru
  s = s.replace(/Dana\s+Perencanaan/gi, "\u0001");
  s = s.replace(/Dana\s+Pengawasan/gi, "\u0002");
  // Kata lepas
  s = s.replace(/Perencanaan/gi, "\u0001");
  s = s.replace(/Pengawasan/gi, "\u0002");
  s = s.replace(/\u0001/g, LABEL_BAYAR_JASA_PERENCANAAN);
  s = s.replace(/\u0002/g, LABEL_BAYAR_JASA_PENGAWASAN);
  return s;
}
