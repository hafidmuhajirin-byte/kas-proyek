"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession } from "@/lib/auth";
import { parseRupiahInput } from "@/lib/money";
import {
  projectFundKinds,
  type ProjectFundKind,
} from "@/lib/project-funds";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

export async function upsertProjectFundsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Proyek tidak ditemukan." };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Proyek tidak ditemukan." };

  for (const kind of projectFundKinds) {
    const plannedAmount = parseRupiahInput(
      String(formData.get(`planned_${kind}`) ?? "0"),
    );
    const notes =
      String(formData.get(`notes_${kind}`) ?? "").trim() || null;

    if (plannedAmount < 0) {
      return { error: "Rencana dana tidak boleh negatif." };
    }

    await prisma.projectFund.upsert({
      where: {
        projectId_kind: {
          projectId,
          kind: kind as ProjectFundKind,
        },
      },
      create: {
        projectId,
        kind: kind as ProjectFundKind,
        plannedAmount,
        notes,
      },
      update: {
        plannedAmount,
        notes,
      },
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/reports");
  revalidatePath("/projects");
  return { success: "Rencana dana operasional proyek disimpan." };
}

export async function ensureProjectFundCategories() {
  await requireSession();
  const { projectFundCategoryNames } = await import("@/lib/project-funds");
  for (const name of Object.values(projectFundCategoryNames)) {
    await prisma.category.upsert({
      where: { name_type: { name, type: "EXPENSE" } },
      update: {},
      create: { name, type: "EXPENSE" },
    });
  }
}

/**
 * Sisa dana save → kas besar (proyek turun, kas besar tetap).
 * Hanya setelah checklist "100% tanpa retensi" dicentang.
 */
export async function releaseSaveFundToGlobalAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const cashSourceId = String(formData.get("cashSourceId") ?? "");
  if (!projectId) return { error: "Proyek tidak ditemukan." };
  if (!cashSourceId) return { error: "Pilih sumber kas." };

  const { SAVE_TO_GLOBAL_CATEGORY } = await import("@/lib/project-completion");
  const {
    projectFundCategoryNames,
    fundKindFromCategoryName,
  } = await import("@/lib/project-funds");
  const { getProjectCashBalance } = await import("@/lib/balance");
  const { formatRupiah } = await import("@/lib/money");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      funds: true,
      transactions: {
        where: { type: "EXPENSE" },
        select: { amount: true, category: { select: { name: true } } },
      },
    },
  });
  if (!project) return { error: "Proyek tidak ditemukan." };
  if (project.standaloneBookkeeping) {
    return {
      error:
        "Proyek mandiri tidak bisa memindah sisa dana ke kas besar Owner.",
    };
  }
  if (!project.checkNoRetention) {
    return {
      error:
        "Centang dulu checklist: proyek 100% selesai tanpa retensi.",
    };
  }

  const planned =
    project.funds.find((f) => f.kind === "SAVE")?.plannedAmount ?? 0;
  let spent = 0;
  for (const tx of project.transactions) {
    if (fundKindFromCategoryName(tx.category.name) === "SAVE") {
      spent += tx.amount;
    }
    if (tx.category.name === SAVE_TO_GLOBAL_CATEGORY) {
      spent += tx.amount;
    }
  }
  const remainingSave = Math.max(0, planned - spent);
  if (remainingSave <= 0) {
    return { error: "Tidak ada sisa dana save yang bisa dimasukkan." };
  }

  const projectCash = await getProjectCashBalance(projectId);
  const amount = Math.min(remainingSave, Math.max(0, projectCash));
  if (amount <= 0) {
    return {
      error: `Kas proyek kosong (tersedia ${formatRupiah(projectCash)}). Tidak ada yang bisa dipindah ke kas besar.`,
    };
  }

  const source = await prisma.cashSource.findUnique({
    where: { id: cashSourceId },
  });
  if (!source) return { error: "Sumber kas tidak ditemukan." };

  const category = await prisma.category.upsert({
    where: {
      name_type: { name: SAVE_TO_GLOBAL_CATEGORY, type: "EXPENSE" },
    },
    update: {},
    create: { name: SAVE_TO_GLOBAL_CATEGORY, type: "EXPENSE" },
  });

  // Juga pastikan kategori Dana Save ada
  await prisma.category.upsert({
    where: {
      name_type: {
        name: projectFundCategoryNames.SAVE,
        type: "EXPENSE",
      },
    },
    update: {},
    create: { name: projectFundCategoryNames.SAVE, type: "EXPENSE" },
  });

  await prisma.transaction.create({
    data: {
      date: new Date(),
      type: "EXPENSE",
      amount,
      description: `Sisa dana save ${formatRupiah(amount)} masuk kas besar (tanpa retensi)`,
      projectId,
      cashSourceId,
      categoryId: category.id,
      createdById: user.id,
      isFromGlobalCash: true,
      isOwnerPersonal: false,
      isFeeTransfer: false,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {
    success: `Sisa dana save ${formatRupiah(amount)} masuk kas besar. Kas proyek turun, kas besar tetap.`,
  };
}
