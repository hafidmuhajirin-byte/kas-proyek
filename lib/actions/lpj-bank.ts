"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { plannedTranchesFromContract } from "@/lib/buku-kas/bank";

function parseIntSafe(raw: FormDataEntryValue | null, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Pastikan baris 70% / 30% ada; isi planned dari nilai SPK. */
export async function ensureBankTranchesAction(formData: FormData) {
  await requireRoleAdmin();
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) redirect("/admin/lpj");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, contractValue: true, status: true },
  });
  if (!project || project.status !== "ACTIVE") redirect("/admin/lpj");

  const { phase70, phase30 } = plannedTranchesFromContract(
    project.contractValue,
  );

  await prisma.bankTranche.upsert({
    where: { projectId_phase: { projectId, phase: "PHASE_70" } },
    create: {
      projectId,
      phase: "PHASE_70",
      percent: 70,
      plannedAmount: phase70,
    },
    update: { plannedAmount: phase70, percent: 70 },
  });
  await prisma.bankTranche.upsert({
    where: { projectId_phase: { projectId, phase: "PHASE_30" } },
    create: {
      projectId,
      phase: "PHASE_30",
      percent: 30,
      plannedAmount: phase30,
    },
    update: { plannedAmount: phase30, percent: 30 },
  });

  revalidatePath(`/admin/lpj/${projectId}/bank`);
  redirect(`/admin/lpj/${projectId}/bank`);
}

export async function updateBankTrancheAction(formData: FormData) {
  await requireRoleAdmin();
  const projectId = String(formData.get("projectId") || "");
  const phase = String(formData.get("phase") || "");
  if (!projectId || (phase !== "PHASE_70" && phase !== "PHASE_30")) {
    redirect("/admin/lpj");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, contractValue: true, status: true },
  });
  if (!project || project.status !== "ACTIVE") redirect("/admin/lpj");

  const planned = plannedTranchesFromContract(project.contractValue);
  const receivedAmount = parseIntSafe(formData.get("receivedAmount"));
  const receivedAt = parseDate(formData.get("receivedAt"));
  const notes = String(formData.get("notes") || "").trim() || null;

  await prisma.bankTranche.upsert({
    where: {
      projectId_phase: {
        projectId,
        phase: phase as "PHASE_70" | "PHASE_30",
      },
    },
    create: {
      projectId,
      phase: phase as "PHASE_70" | "PHASE_30",
      percent: phase === "PHASE_70" ? 70 : 30,
      plannedAmount: phase === "PHASE_70" ? planned.phase70 : planned.phase30,
      receivedAmount,
      receivedAt,
      notes,
    },
    update: {
      receivedAmount,
      receivedAt,
      notes,
    },
  });

  revalidatePath(`/admin/lpj/${projectId}/bank`);
  redirect(`/admin/lpj/${projectId}/bank`);
}
