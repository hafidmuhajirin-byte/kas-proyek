import type { SessionRole } from "@/lib/session";

/** Proyek/pekerjaan dikecualikan dari semua info Asisten. */
const EXCLUDED_PROJECT_PATTERNS = [/bpk\s*sofyan/i, /\bsofyan\b/i];

export function isAssistantExcludedProject(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  return EXCLUDED_PROJECT_PATTERNS.some((re) => re.test(n));
}

/** Kas/fee/keuntungan/transaksi Owner — hanya Owner & AdminOK. */
export function canSeeFinance(role: SessionRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Pantauan LPJ operasional (nota/split/pajak) — Owner & AdminOK (+ Admin Proyek/LPJ Viewer untuk proyeknya). */
export function canSeeLpjOps(role: SessionRole): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "ADMIN_PROYEK" ||
    role === "LPJ_VIEWER"
  );
}

export function assistantEnabledForRole(role: SessionRole): boolean {
  return role !== "ADM_FOTO";
}

export function filterExcludedProjects<T extends { name: string }>(
  projects: T[],
): T[] {
  return projects.filter((p) => !isAssistantExcludedProject(p.name));
}
