"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getProjectCashBalance } from "@/lib/balance";
import { formatRupiah, parseRupiahInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  isChecklistComplete,
  projectChecklistKeys,
  unfinishedChecklistLabels,
  type ProjectChecklistKey,
  type ProjectChecklistState,
} from "@/lib/project-completion";

export type FormState = {
  error?: string;
  success?: string;
};

const billingModes = ["ON_REQUEST", "TERMIN_PLAN", "PAY_AT_END"] as const;

function parseBillingMode(value: string) {
  if (billingModes.includes(value as (typeof billingModes)[number])) {
    return value as (typeof billingModes)[number];
  }
  return null;
}

function checklistFromProject(project: {
  checkPlanning: boolean;
  checkSupervision: boolean;
  checkManagement: boolean;
  checkTax: boolean;
  checkReporting: boolean;
  checkContractor: boolean;
  checkNoRetention: boolean;
}): ProjectChecklistState {
  return {
    checkPlanning: project.checkPlanning,
    checkSupervision: project.checkSupervision,
    checkManagement: project.checkManagement,
    checkTax: project.checkTax,
    checkReporting: project.checkReporting,
    checkContractor: project.checkContractor,
    checkNoRetention: project.checkNoRetention,
  };
}

async function assertCanComplete(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return "Proyek tidak ditemukan.";

  const checks = checklistFromProject(project);
  if (!isChecklistComplete(checks)) {
    const missing = unfinishedChecklistLabels(checks).join("; ");
    return `Checklist belum lengkap: ${missing}.`;
  }

  const cash = await getProjectCashBalance(projectId);
  if (cash !== 0) {
    return `Kas proyek harus tepat Rp 0 sebelum ditandai selesai (sekarang ${formatRupiah(cash)}). Catat ambil owner atau sisa ke sekolah dulu.`;
  }

  return null;
}

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "ACTIVE");
  const billingMode = parseBillingMode(
    String(formData.get("billingMode") ?? "ON_REQUEST"),
  );
  let openingBalance = parseRupiahInput(
    String(formData.get("openingBalance") ?? "0"),
  );
  let contractValue = parseRupiahInput(
    String(formData.get("contractValue") ?? "0"),
  );

  if (!name || !location) {
    return { error: "Nama dan lokasi proyek wajib diisi." };
  }
  if (status !== "ACTIVE" && status !== "COMPLETED") {
    return { error: "Status tidak valid." };
  }
  if (status === "COMPLETED") {
    return {
      error:
        "Proyek baru tidak bisa langsung Selesai. Buat sebagai Aktif, lengkapi checklist di detail, kosongkan kas, lalu tandai selesai.",
    };
  }
  if (!billingMode) {
    return { error: "Mode pembayaran tidak valid." };
  }

  const standaloneBookkeeping =
    formData.get("standaloneBookkeeping") === "on" ||
    formData.get("standaloneBookkeeping") === "1";

  // Kerja dulu bayar di akhir: tidak memakai nilai kontrak; saldo awal selalu 0
  // (kecuali proyek mandiri — tetap boleh punya saldo proyek)
  if (billingMode === "PAY_AT_END" && !standaloneBookkeeping) {
    contractValue = 0;
    openingBalance = 0;
  }
  if (billingMode === "PAY_AT_END" && standaloneBookkeeping) {
    contractValue = 0;
  }

  await prisma.project.create({
    data: {
      name,
      location,
      notes,
      status,
      billingMode,
      openingBalance,
      contractValue,
      standaloneBookkeeping,
    },
  });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  if (standaloneBookkeeping) {
    return {
      success:
        "Proyek mandiri dibuat. Kas terpisah dari kas besar Owner — tugaskan Admin Proyek, Mandor, dan ADM Foto.",
    };
  }
  return {
    success:
      billingMode === "PAY_AT_END"
        ? "Proyek dibuat. Pengeluaran dari kas besar; jika habis wajib setor dana pribadi."
        : openingBalance > 0
          ? "Proyek berhasil ditambahkan."
          : "Proyek ditambahkan tanpa saldo awal. Pengeluaran akan ambil dari kas besar.",
  };
}

export async function updateProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "ACTIVE");
  const billingMode = parseBillingMode(
    String(formData.get("billingMode") ?? "ON_REQUEST"),
  );
  let openingBalance = parseRupiahInput(
    String(formData.get("openingBalance") ?? "0"),
  );
  let contractValue = parseRupiahInput(
    String(formData.get("contractValue") ?? "0"),
  );

  if (!id || !name || !location) {
    return { error: "Data proyek tidak lengkap." };
  }
  if (status !== "ACTIVE" && status !== "COMPLETED") {
    return { error: "Status tidak valid." };
  }
  if (!billingMode) {
    return { error: "Mode pembayaran tidak valid." };
  }

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { standaloneBookkeeping: true },
  });
  if (!existing) return { error: "Proyek tidak ditemukan." };

  if (billingMode === "PAY_AT_END" && !existing.standaloneBookkeeping) {
    contractValue = 0;
    openingBalance = 0;
  } else if (billingMode === "PAY_AT_END" && existing.standaloneBookkeeping) {
    contractValue = 0;
  } else {
    const paid = await prisma.transaction.aggregate({
      where: {
        projectId: id,
        type: "INCOME",
        isOwnerPersonal: false,
      },
      _sum: { amount: true },
    });
    const alreadyPaid = paid._sum.amount ?? 0;
    if (contractValue > 0 && contractValue < alreadyPaid) {
      return {
        error: `Nilai kontrak tidak boleh lebih kecil dari total pembayaran klien yang sudah diterima (${formatRupiah(alreadyPaid)}).`,
      };
    }
  }

  if (status === "COMPLETED") {
    const block = await assertCanComplete(id);
    if (block) return { error: block };
  }

  // standaloneBookkeeping tidak bisa diubah setelah dibuat
  await prisma.project.update({
    where: { id },
    data: {
      name,
      location,
      notes,
      status,
      billingMode,
      openingBalance,
      contractValue,
    },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: "Proyek berhasil diperbarui." };
}

export async function updateProjectChecklistAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Proyek tidak ditemukan." };

  const data: Partial<Record<ProjectChecklistKey, boolean>> = {};
  for (const key of projectChecklistKeys) {
    data[key] = formData.get(key) === "on";
  }

  await prisma.project.update({
    where: { id },
    data,
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: "Checklist penyelesaian disimpan." };
}

export async function markProjectCompletedAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Proyek tidak ditemukan." };

  const block = await assertCanComplete(id);
  if (block) return { error: block };

  await prisma.project.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: "Proyek ditandai selesai." };
}

export async function reopenProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Proyek tidak ditemukan." };

  await prisma.project.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: "Proyek dibuka kembali (aktif)." };
}

export async function deleteProjectAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const count = await prisma.transaction.count({ where: { projectId: id } });
  if (count > 0) {
    redirect(
      `/projects?error=${encodeURIComponent(
        "Proyek tidak bisa dihapus karena masih punya transaksi.",
      )}`,
    );
  }

  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}
