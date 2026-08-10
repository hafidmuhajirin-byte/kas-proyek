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

async function ensureTaxExpenseCategory(): Promise<string> {
  const name = "Pembayaran Pajak";
  const existing = await prisma.category.findFirst({
    where: { name, type: "EXPENSE" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { name, type: "EXPENSE" },
    select: { id: true },
  });
  return created.id;
}

async function ensurePphFinalIncomeCategory(): Promise<string> {
  const name = "Terima PPh Final";
  const existing = await prisma.category.findFirst({
    where: { name, type: "INCOME" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { name, type: "INCOME" },
    select: { id: true },
  });
  return created.id;
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
 * Bayar kewajiban pajak: upload bukti + ID billing → buat pengeluaran kas + tandai PAID.
 * PPh Final: juga catat penerimaan pasangan agar saldo net 0 (sama BKU).
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
  const cashSourceId = String(formData.get("cashSourceId") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "").trim();

  if (!obligationId) return { error: "Kewajiban pajak tidak ditemukan." };
  if (!billingId) return { error: "ID billing / NTPN wajib diisi." };
  if (!cashSourceId) return { error: "Pilih sumber kas pembayaran." };

  const paidAt = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return { error: "Tanggal bayar tidak valid." };
  }

  const obligation = await prisma.taxWithholdingLine.findUnique({
    where: { id: obligationId },
    include: {
      transaction: {
        select: { description: true, date: true },
      },
    },
  });
  if (!obligation) return { error: "Kewajiban pajak tidak ditemukan." };
  if (obligation.status === "PAID") {
    return { error: "Pajak ini sudah dibayar." };
  }

  await requireLpjAccess(obligation.projectId);
  if (user.role === "ADMIN_PROYEK") {
    await requireProjectAccess(user, obligation.projectId);
  }

  const cashSource = await prisma.cashSource.findUnique({
    where: { id: cashSourceId },
    select: { id: true },
  });
  if (!cashSource) return { error: "Sumber kas tidak valid." };

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

  const expenseCategoryId = await ensureTaxExpenseCategory();
  const sourceNote = obligation.transaction?.description
    ? ` · nota: ${obligation.transaction.description.slice(0, 80)}`
    : "";
  const payDescription = `${kindPayLabel(obligation.kind)} · billing ${billingId}${sourceNote}`;

  const paymentTx = await prisma.transaction.create({
    data: {
      date: paidAt,
      type: "EXPENSE",
      amount: obligation.taxAmount,
      description: payDescription,
      proofUrl,
      projectId: obligation.projectId,
      cashSourceId,
      categoryId: expenseCategoryId,
      createdById: user.id,
      isTaxPayment: true,
      isOwnerPersonal: false,
      isFromGlobalCash: false,
      isFeeTransfer: false,
      isMandorDisbursement: false,
      isMandorExpense: false,
      breakdownStatus: "APPROVED",
    },
  });

  // PPh Final: pasangan penerimaan agar net kas 0 (format BKU)
  if (obligation.kind === "PPH_FINAL_35") {
    const incomeCategoryId = await ensurePphFinalIncomeCategory();
    await prisma.transaction.create({
      data: {
        date: paidAt,
        type: "INCOME",
        amount: obligation.taxAmount,
        description: `Terima PPh Pasal 4 ayat 2 (3,5%) · billing ${billingId}${sourceNote}`,
        proofUrl,
        projectId: obligation.projectId,
        cashSourceId,
        categoryId: incomeCategoryId,
        createdById: user.id,
        isTaxPayment: true,
        isOwnerPersonal: false,
        breakdownStatus: "APPROVED",
      },
    });
  }

  await prisma.taxWithholdingLine.update({
    where: { id: obligation.id },
    data: {
      status: "PAID",
      billingId,
      proofUrl,
      paidAt,
      paidById: user.id,
      paymentTransactionId: paymentTx.id,
    },
  });

  revalidateTaxPaths(obligation.projectId);
  return { success: "Pajak berhasil dibayar. Pengeluaran kas bertambah." };
}

function kindPayLabel(kind: string): string {
  if (kind === "PPN_11") return "Bayar Pajak PPN (11%)";
  if (kind === "PPH_15") return "Bayar Pajak PPH (1,5%)";
  return "Bayar PPh Pasal 4 ayat 2 (3,5%)";
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
