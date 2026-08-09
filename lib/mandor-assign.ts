/**
 * Penugasan Mandor ke proyek (ProjectAssignment).
 * Nama pemborong sering diisi sama dengan nama akun Mandor — dinormalisasi
 * agar bisa di-link otomatis tanpa bergantung ejaan "Bpk"/"Bok"/"Pak".
 */

/** Normalisasi nama untuk pencocokan: lowercase, buang gelar umum, rapikan spasi. */
export function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(
      /\b(bpk|bapak|bok|pak|ibu|bu|sdr|saudara|sdri)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Apakah dua nama orang merujuk orang yang sama (longgar). */
export function namesLikelyMatch(a: string, b: string): boolean {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Satu nama mengandung yang lain (min 3 karakter) — tangkap typo pendek
  if (na.length >= 3 && nb.length >= 3) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

export type MandorCandidate = {
  id: string;
  name: string;
  username: string;
};

/** Cari akun Mandor yang namanya cocok dengan teks (pemborong / label). */
export function findMandorByName(
  candidates: MandorCandidate[],
  rawName: string,
): MandorCandidate | null {
  const exact = candidates.find((c) => namesLikelyMatch(c.name, rawName));
  if (exact) return exact;
  // Fallback: cocokkan dengan username
  const key = normalizePersonName(rawName);
  return (
    candidates.find((c) => normalizePersonName(c.username) === key) ?? null
  );
}
