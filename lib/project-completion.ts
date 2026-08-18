export const projectChecklistKeys = [
  "checkPlanning",
  "checkSupervision",
  "checkManagement",
  "checkTax",
  "checkReporting",
  "checkContractor",
  "checkNoRetention",
] as const;

export type ProjectChecklistKey = (typeof projectChecklistKeys)[number];

export const projectChecklistLabels: Record<ProjectChecklistKey, string> = {
  checkPlanning: "Bayar jasa perencana terbayar",
  checkSupervision: "Bayar jasa Pengawas terbayar",
  checkManagement: "Dana pengelolaan terbayar",
  checkTax: "Pajak terbayar",
  checkReporting: "Dana laporan terbayar",
  checkContractor: "Pemborong selesai / tidak dipakai",
  checkNoRetention: "Proyek 100% selesai tanpa retensi",
};

export const SCHOOL_RESIDUAL_CATEGORY = "Sisa Dana Sekolah";
export const FEE_TRANSFER_CATEGORY = "Transfer Fee ke Bank Pribadi";
export const SAVE_TO_GLOBAL_CATEGORY = "Sisa Dana Save ke Kas Besar";

export type ProjectChecklistState = Record<ProjectChecklistKey, boolean>;

export function countCheckedChecklist(checks: ProjectChecklistState) {
  return projectChecklistKeys.filter((key) => checks[key]).length;
}

export function checklistProgressPercent(checks: ProjectChecklistState) {
  const total = projectChecklistKeys.length;
  return Math.round((countCheckedChecklist(checks) / total) * 100);
}

export function unfinishedChecklistLabels(checks: ProjectChecklistState) {
  return projectChecklistKeys
    .filter((key) => !checks[key])
    .map((key) => projectChecklistLabels[key]);
}

export function isChecklistComplete(checks: ProjectChecklistState) {
  return unfinishedChecklistLabels(checks).length === 0;
}
