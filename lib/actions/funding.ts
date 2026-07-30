"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRupiahInput } from "@/lib/money";
import type { FormState } from "@/lib/actions/projects";

export async function createFundingStageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const percent = Number.parseInt(String(formData.get("percent") ?? "0"), 10);
  let plannedAmount = parseRupiahInput(String(formData.get("plannedAmount") ?? "0"));
  const sequence = Number.parseInt(String(formData.get("sequence") ?? "1"), 10);

  if (!projectId || !name) {
    return { error: "Nama tahapan wajib diisi." };
  }
  if (Number.isNaN(percent) || percent < 0 || percent > 100) {
    return { error: "Persentase harus antara 0–100." };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Proyek tidak ditemukan." };

  if (plannedAmount <= 0 && percent > 0 && project.contractValue > 0) {
    plannedAmount = Math.round((project.contractValue * percent) / 100);
  }
  if (plannedAmount <= 0) {
    return { error: "Isi nominal rencana atau persentase (dengan nilai kontrak proyek)." };
  }

  const existingStages = await prisma.fundingStage.findMany({
    where: { projectId },
    select: { percent: true },
  });
  const totalPercent = existingStages.reduce((sum, s) => sum + s.percent, 0) + percent;
  if (totalPercent > 100) {
    return {
      error: `Total persentase tahapan akan menjadi ${totalPercent}%. Maksimal 100%.`,
    };
  }

  const maxSeq = await prisma.fundingStage.aggregate({
    where: { projectId },
    _max: { sequence: true },
  });

  await prisma.fundingStage.create({
    data: {
      projectId,
      name,
      notes,
      percent,
      plannedAmount,
      sequence: Number.isNaN(sequence) ? (maxSeq._max.sequence ?? 0) + 1 : sequence,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: "Tahapan dana berhasil ditambahkan." };
}

export async function updateFundingStageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const percent = Number.parseInt(String(formData.get("percent") ?? "0"), 10);
  let plannedAmount = parseRupiahInput(String(formData.get("plannedAmount") ?? "0"));
  const sequence = Number.parseInt(String(formData.get("sequence") ?? "1"), 10);

  if (!id || !name) return { error: "Data tahapan tidak lengkap." };
  if (Number.isNaN(percent) || percent < 0 || percent > 100) {
    return { error: "Persentase harus antara 0–100." };
  }

  const stage = await prisma.fundingStage.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!stage) return { error: "Tahapan tidak ditemukan." };

  if (plannedAmount <= 0 && percent > 0 && stage.project.contractValue > 0) {
    plannedAmount = Math.round((stage.project.contractValue * percent) / 100);
  }
  if (plannedAmount <= 0) {
    return { error: "Nominal rencana harus lebih dari 0." };
  }

  const siblings = await prisma.fundingStage.findMany({
    where: { projectId: stage.projectId, NOT: { id } },
    select: { percent: true },
  });
  const totalPercent = siblings.reduce((sum, s) => sum + s.percent, 0) + percent;
  if (totalPercent > 100) {
    return {
      error: `Total persentase tahapan akan menjadi ${totalPercent}%. Maksimal 100%.`,
    };
  }

  await prisma.fundingStage.update({
    where: { id },
    data: {
      name,
      notes,
      percent,
      plannedAmount,
      sequence: Number.isNaN(sequence) ? stage.sequence : sequence,
    },
  });

  revalidatePath(`/projects/${stage.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: "Tahapan dana diperbarui." };
}

export async function deleteFundingStageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const stage = await prisma.fundingStage.findUnique({ where: { id } });
  if (!stage) return;

  await prisma.fundingStage.delete({ where: { id } });
  revalidatePath(`/projects/${stage.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function getFundingStagesForProject(projectId: string) {
  await requireSession();
  return prisma.fundingStage.findMany({
    where: { projectId },
    orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
    include: {
      transactions: {
        where: { type: "INCOME" },
        select: { amount: true },
      },
    },
  });
}
