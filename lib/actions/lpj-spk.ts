"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLpjAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SPK_CATEGORIES,
  defaultLaborMaterialPercent,
  type SpkCategoryKey,
} from "@/lib/lpj/smart-estimator";

function parseIntSafe(raw: FormDataEntryValue | null, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

export async function upsertSpkBudgetAction(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) redirect("/admin/lpj");
  await requireLpjAccess(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true },
  });
  if (!project || project.status !== "ACTIVE") redirect("/admin/lpj");

  for (const category of SPK_CATEGORIES) {
    const amount = parseIntSafe(formData.get(`amount__${category}`));
    const defaults = defaultLaborMaterialPercent(category);
    let laborPercent = parseIntSafe(
      formData.get(`labor__${category}`),
      defaults.laborPercent,
    );
    let materialPercent = parseIntSafe(
      formData.get(`material__${category}`),
      defaults.materialPercent,
    );
    laborPercent = Math.min(100, Math.max(0, laborPercent));
    materialPercent = Math.min(100, Math.max(0, materialPercent));
    const isBeliBaru = formData.get(`beliBaru__${category}`) === "1";

    await prisma.spkBudgetLine.upsert({
      where: {
        projectId_category: {
          projectId,
          category: category as SpkCategoryKey,
        },
      },
      create: {
        projectId,
        category: category as SpkCategoryKey,
        amount,
        laborPercent,
        materialPercent,
        isBeliBaru,
      },
      update: {
        amount,
        laborPercent,
        materialPercent,
        isBeliBaru,
      },
    });
  }

  revalidatePath(`/admin/lpj/${projectId}`);
  revalidatePath(`/admin/lpj/${projectId}/spk`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/mandor");
  redirect(`/admin/lpj/${projectId}/spk`);
}
