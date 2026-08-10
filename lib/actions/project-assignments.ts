"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

function revalidateAssignment(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/users");
  revalidatePath("/mandor");
  revalidatePath("/mandor/upload");
  revalidatePath("/dashboard");
}

/** Tugaskan akun Mandor ke proyek — muncul di login Mandor. */
export async function assignMandorToProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();

  const projectId = String(formData.get("projectId") ?? "");
  const userId = String(formData.get("userId") ?? "");

  if (!projectId || !userId) {
    return { error: "Pilih Mandor yang akan ditugaskan." };
  }

  const [project, user] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    }),
  ]);

  if (!project) return { error: "Proyek tidak ditemukan." };
  if (!user || (user.role !== "MANDOR" && user.role !== "ADM_FOTO")) {
    return { error: "Akun yang dipilih bukan Mandor / ADM Foto." };
  }

  await prisma.projectAssignment.upsert({
    where: {
      userId_projectId: { userId, projectId },
    },
    create: { userId, projectId },
    update: {},
  });

  revalidateAssignment(projectId);
  return { success: `${user.name} ditugaskan ke proyek ini.` };
}

/** Hapus penugasan Mandor dari proyek (tidak menghapus akun). */
export async function unassignMandorFromProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();

  const projectId = String(formData.get("projectId") ?? "");
  const userId = String(formData.get("userId") ?? "");

  if (!projectId || !userId) {
    return { error: "Data penugasan tidak lengkap." };
  }

  const disbursementCount = await prisma.mandorDisbursement.count({
    where: { projectId, mandorId: userId },
  });
  if (disbursementCount > 0) {
    return {
      error:
        "Tidak bisa dilepas: Mandor ini sudah punya pencairan di proyek. Hapus/sesuaikan pencairan dulu jika perlu.",
    };
  }

  await prisma.projectAssignment.deleteMany({
    where: { userId, projectId },
  });

  revalidateAssignment(projectId);
  return { success: "Penugasan Mandor dihapus dari proyek." };
}
