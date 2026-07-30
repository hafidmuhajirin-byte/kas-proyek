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
  PLANNING: "Dana perencanaan",
  SUPERVISION: "Dana pengawasan",
  MANAGEMENT: "Dana pengelolaan",
  TAX: "Pembayaran pajak",
  REPORTING: "Dana pembuatan laporan",
  SAVE: "Dana save (keamanan)",
};

/** Nama kategori pengeluaran yang dipakai saat catat transaksi */
export const projectFundCategoryNames: Record<ProjectFundKind, string> = {
  PLANNING: "Dana Perencanaan",
  SUPERVISION: "Dana Pengawasan",
  MANAGEMENT: "Dana Pengelolaan",
  TAX: "Pembayaran Pajak",
  REPORTING: "Dana Pembuatan Laporan",
  SAVE: "Dana Save",
};

export function calcProjectSaveAmount(contractValue: number) {
  if (contractValue <= 0) return 0;
  return Math.round((contractValue * PROJECT_SAVE_PERCENT) / 100);
}

export function fundKindFromCategoryName(
  name: string,
): ProjectFundKind | null {
  const entry = Object.entries(projectFundCategoryNames).find(
    ([, label]) => label.toLowerCase() === name.trim().toLowerCase(),
  );
  return (entry?.[0] as ProjectFundKind | undefined) ?? null;
}
