import {
  LABEL_BAYAR_JASA_PENGAWASAN,
  LABEL_BAYAR_JASA_PERENCANAAN,
} from "@/lib/lpj/jasa-labels";

export const projectFundKinds = [
  "PLANNING",
  "SUPERVISION",
  "MANAGEMENT",
  "TAX",
  "REPORTING",
  "SAVE",
] as const;

export type ProjectFundKind = (typeof projectFundKinds)[number];

/** Persentase dana save (keamanan proyek) dari nilai kontrak */
export const PROJECT_SAVE_PERCENT = 7.5;

export const projectFundLabels: Record<ProjectFundKind, string> = {
  PLANNING: LABEL_BAYAR_JASA_PERENCANAAN,
  SUPERVISION: LABEL_BAYAR_JASA_PENGAWASAN,
  MANAGEMENT: "Dana pengelolaan",
  TAX: "Pembayaran pajak",
  REPORTING: "Dana pembuatan laporan",
  SAVE: "Dana save (keamanan)",
};

/** Nama kategori pengeluaran yang dipakai saat catat transaksi */
export const projectFundCategoryNames: Record<ProjectFundKind, string> = {
  PLANNING: LABEL_BAYAR_JASA_PERENCANAAN,
  SUPERVISION: LABEL_BAYAR_JASA_PENGAWASAN,
  MANAGEMENT: "Dana Pengelolaan",
  TAX: "Pembayaran Pajak",
  REPORTING: "Dana Pembuatan Laporan",
  SAVE: "Dana Save",
};

/** Nama kategori lama — tetap dikenali agar data historis tidak putus. */
const LEGACY_PROJECT_FUND_CATEGORY_NAMES: Partial<
  Record<ProjectFundKind, string[]>
> = {
  PLANNING: ["Dana Perencanaan", "Dana perencanaan", "Perencanaan"],
  SUPERVISION: ["Dana Pengawasan", "Dana pengawasan", "Pengawasan"],
};

export function calcProjectSaveAmount(contractValue: number) {
  if (contractValue <= 0) return 0;
  return Math.round((contractValue * PROJECT_SAVE_PERCENT) / 100);
}

export function fundKindFromCategoryName(
  name: string,
): ProjectFundKind | null {
  const needle = name.trim().toLowerCase();
  const entry = Object.entries(projectFundCategoryNames).find(
    ([, label]) => label.toLowerCase() === needle,
  );
  if (entry) return entry[0] as ProjectFundKind;

  for (const [kind, aliases] of Object.entries(
    LEGACY_PROJECT_FUND_CATEGORY_NAMES,
  )) {
    if (aliases?.some((a) => a.toLowerCase() === needle)) {
      return kind as ProjectFundKind;
    }
  }
  return null;
}
