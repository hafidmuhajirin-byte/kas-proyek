/** Peran pekerja di pecah isi gaji Mandor. */
export const LABOR_ROLES = ["Tukang", "Pembantu tukang"] as const;
export type LaborRole = (typeof LABOR_ROLES)[number];

export function isLaborRole(value: string): value is LaborRole {
  return (LABOR_ROLES as readonly string[]).includes(value);
}

export function normalizeWorkerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
