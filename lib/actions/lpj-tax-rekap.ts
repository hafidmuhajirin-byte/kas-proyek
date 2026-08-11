"use server";

import { revalidatePath } from "next/cache";
import { requireLpjEditor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

export async function updateLpjNpwpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Proyek tidak valid." };
  await requireLpjEditor(projectId);
  const npwp = String(formData.get("lpjNpwp") ?? "").trim() || null;

  await prisma.project.update({
    where: { id: projectId },
    data: { lpjNpwp: npwp },
  });

  revalidatePath(`/admin/lpj/${projectId}/pajak`);
  revalidatePath(`/admin/lpj/${projectId}/export`);
  revalidatePath(`/admin/lpj/${projectId}/bank`);
  return { success: "NPWP disimpan." };
}

export async function updateTaxMonthNoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("projectId") ?? "");
  const year = Number(formData.get("year") ?? 0);
  const month = Number(formData.get("month") ?? 0);
  const keterangan = String(formData.get("keterangan") ?? "").trim() || null;
  if (!projectId || !(year > 2000) || month < 1 || month > 12) {
    return { error: "Data bulan tidak valid." };
  }
  await requireLpjEditor(projectId);

  await prisma.taxMonthNote.upsert({
    where: {
      projectId_year_month: { projectId, year, month },
    },
    create: { projectId, year, month, keterangan },
    update: { keterangan },
  });

  revalidatePath(`/admin/lpj/${projectId}/pajak`);
  revalidatePath(`/admin/lpj/${projectId}/export`);
  return { success: "Keterangan disimpan." };
}
