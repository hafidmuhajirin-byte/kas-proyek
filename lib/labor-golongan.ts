/** Golongan HOK pada daftar hadir resmi. */
export type LaborGol = "A" | "B" | "C";

export const LABOR_GOL_LABELS: Record<LaborGol, string> = {
  A: "Kepala Tukang",
  B: "Tukang",
  C: "Kuli / Helper",
};

/** Petakan peran pecah nota → golongan cetak. */
export function golFromRole(role: string | null | undefined): LaborGol {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return "C";
  if (r.includes("kepala")) return "A";
  if (r === "tukang" || (r.includes("tukang") && !r.includes("pembantu"))) {
    return "B";
  }
  if (r.includes("pembantu") || r.includes("helper") || r.includes("kuli")) {
    return "C";
  }
  return "C";
}
