"use server";

import { revalidatePath } from "next/cache";
import { requireProjectBookkeeper } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRupiahInput } from "@/lib/money";
import type { FormState } from "@/lib/actions/projects";

export async function createWorkItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Proyek wajib." };
  await requireProjectBookkeeper(projectId);
  const dateRaw = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = quantityRaw ? Number.parseFloat(quantityRaw) : null;

  if (!projectId || !dateRaw || !description) {
    return { error: "Tanggal dan uraian pekerjaan wajib diisi." };
  }
  if (amount <= 0) {
    return { error: "Nilai pekerjaan harus lebih dari 0." };
  }
  if (quantity !== null && Number.isNaN(quantity)) {
    return { error: "Volume/kuantitas tidak valid." };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Proyek tidak ditemukan." };

  await prisma.workItem.create({
    data: {
      projectId,
      date: new Date(dateRaw),
      description,
      unit,
      notes,
      amount,
      quantity,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: "Pekerjaan selesai berhasil dicatat." };
}

export async function updateWorkItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const dateRaw = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = quantityRaw ? Number.parseFloat(quantityRaw) : null;

  if (!id || !dateRaw || !description) {
    return { error: "Data pekerjaan tidak lengkap." };
  }
  if (amount <= 0) {
    return { error: "Nilai pekerjaan harus lebih dari 0." };
  }

  const item = await prisma.workItem.findUnique({ where: { id } });
  if (!item) return { error: "Data pekerjaan tidak ditemukan." };
  await requireProjectBookkeeper(item.projectId);

  await prisma.workItem.update({
    where: { id },
    data: {
      date: new Date(dateRaw),
      description,
      unit,
      notes,
      amount,
      quantity,
    },
  });

  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: "Data pekerjaan diperbarui." };
}

export async function deleteWorkItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const existing = await prisma.workItem.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!existing) return;
  await requireProjectBookkeeper(existing.projectId);

  const item = await prisma.workItem.findUnique({ where: { id } });
  if (!item) return;

  await prisma.workItem.delete({ where: { id } });
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}
