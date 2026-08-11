"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import {
  requireLpjAccess,
  requireProjectAccess,
  requireSession,
  isOwner,
  isAdmin,
  isAdminProyek,
  type SessionUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";
import { syncTaxObligationsForExpense } from "@/lib/tax-obligations";

async function saveTaxProof(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran bukti maksimal 5 MB.");
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) {
    throw new Error("Bukti harus berupa JPG, PNG, WEBP, atau PDF.");
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const ext =
    file.type === "application/pdf"
      ? ".pdf"
      : file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
          ? ".webp"
          : ".jpg";
  const filename = `pajak-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

function canPayTax(user: SessionUser): boolean {
  return isOwner(user) || isAdmin(user) || isAdminProyek(user);
}

function revalidateTaxPaths(projectId: string) {
  revalidatePath("/transactions");
  revalidatePath("/transactions/project");
  revalidatePath("/admin/lpj");
  revalidatePath(`/admin/lpj/${projectId}`);
  revalidatePath(`/admin/lpj/${projectId}/pajak`);
  revalidatePath(`/admin/lpj/${projectId}/export`);
  revalidatePath("/admin-proyek");
}

/**
 * Catat pelunasan pajak: ID billing + bukti bayar.
 * Kas BKU/BKT sudah dipotong saat nota; aksi ini hanya melunasi kewajiban
 * (pengeluaran terhutang) tanpa membuat transaksi kas baru.
 */
export async function payTaxObligationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  if (!canPayTax(user)) {
    return { error: "Tidak diizinkan membayar pajak." };
  }

  const obligationId = String(formData.get("obligationId") ?? "").trim();
  const billingId = String(formData.get("billingId") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "").trim();

  if (!obligationId) return { error: "Kewajiban pajak tidak ditemukan." };
  if (!billingId) return { error: "ID billing / NTPN wajib diisi." };

  const paidAt = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return { error: "Tanggal bayar tidak valid." };
  }

  const obligation = await prisma.taxWithholdingLine.findUnique({
    where: { id: obligationId },
  });
  if (!obligation) return { error: "Kewajiban pajak tidak ditemukan." };
  if (obligation.status === "PAID") {
    return { error: "Pajak ini sudah dibayar." };
  }

  await requireLpjAccess(obligation.projectId);
  if (user.role === "ADMIN_PROYEK") {
    await requireProjectAccess(user, obligation.projectId);
  }

  let proofUrl: string | null = null;
  try {
    proofUrl = await saveTaxProof(formData.get("proof") as File | null);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal upload bukti bayar.",
    };
  }
  if (!proofUrl) {
    return { error: "Bukti bayar pajak wajib diunggah." };
  }

  await prisma.taxWithholdingLine.update({
    where: { id: obligation.id },
    data: {
      status: "PAID",
      billingId,
      proofUrl,
      paidAt,
      paidById: user.id,
      paymentTransactionId: null,
    },
  });

  revalidateTaxPaths(obligation.projectId);
  return {
    success:
      "Bukti bayar tersimpan. Pajak terhutang dilunasi (kas BKU/BKT sudah dipotong saat nota).",
  };
}

/** Sinkron ulang kewajiban pajak proyek (AdminOK / Admin Proyek). */
export async function syncTaxObligationsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  if (!canPayTax(user)) return { error: "Tidak diizinkan." };

  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return { error: "Proyek wajib." };
  await requireLpjAccess(projectId);

  const expenses = await prisma.transaction.findMany({
    where: {
      projectId,
      type: "EXPENSE",
      isOwnerPersonal: false,
      isFeeTransfer: false,
      isMandorDisbursement: false,
      isSplitParent: false,
      isTaxPayment: false,
    },
    select: {
      id: true,
      projectId: true,
      date: true,
      amount: true,
      description: true,
      isMaterialAlam: true,
      isMandorExpense: true,
      breakdownStatus: true,
      isSplitParent: true,
      isTaxPayment: true,
      isMandorDisbursement: true,
      isFeeTransfer: true,
      isOwnerPersonal: true,
      category: { select: { name: true } },
      expenseLines: {
        select: {
          amount: true,
          description: true,
          kind: true,
          isMaterialAlam: true,
        },
      },
    },
  });

  for (const e of expenses) {
    if (!e.projectId) continue;
    await syncTaxObligationsForExpense({
      id: e.id,
      projectId: e.projectId,
      date: e.date,
      amount: e.amount,
      description: e.description,
      categoryName: e.category.name,
      isMaterialAlam: e.isMaterialAlam,
      isMandorExpense: e.isMandorExpense,
      breakdownStatus: e.breakdownStatus,
      isSplitParent: e.isSplitParent,
      isTaxPayment: e.isTaxPayment,
      isMandorDisbursement: e.isMandorDisbursement,
      isFeeTransfer: e.isFeeTransfer,
      isOwnerPersonal: e.isOwnerPersonal,
      lines: e.expenseLines,
    });
  }

  revalidateTaxPaths(projectId);
  return { success: `Sinkron ${expenses.length} nota.` };
}
