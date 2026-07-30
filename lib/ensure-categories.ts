import { prisma } from "@/lib/prisma";
import {
  FEE_TRANSFER_CATEGORY,
  SCHOOL_RESIDUAL_CATEGORY,
  SAVE_TO_GLOBAL_CATEGORY,
} from "@/lib/project-completion";
import { projectFundCategoryNames } from "@/lib/project-funds";

const REQUIRED_EXPENSE = [
  ...Object.values(projectFundCategoryNames),
  SCHOOL_RESIDUAL_CATEGORY,
  FEE_TRANSFER_CATEGORY,
  SAVE_TO_GLOBAL_CATEGORY,
  "Pencairan ke Mandor",
  "Belanja Mandor",
];

let ensured: Promise<void> | null = null;

/** Hanya sekali per proses server — jangan upsert di setiap request. */
export function ensureRequiredCategories(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const existing = await prisma.category.findMany({
        where: {
          type: "EXPENSE",
          name: { in: REQUIRED_EXPENSE },
        },
        select: { name: true },
      });
      const have = new Set(existing.map((c) => c.name));
      const missing = REQUIRED_EXPENSE.filter((n) => !have.has(n));
      if (missing.length === 0) return;
      await prisma.category.createMany({
        data: missing.map((name) => ({ name, type: "EXPENSE" as const })),
      });
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
