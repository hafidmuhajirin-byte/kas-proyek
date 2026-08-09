"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAdmin } from "@/lib/auth";
import { TAX_THRESHOLD } from "@/lib/lpj/tax-compliance";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

const MAX_BKK_PARTS = 3;

function revalidateSplit(projectId: string | null | undefined) {
  revalidatePath("/mandor");
  revalidatePath("/transactions");
  revalidatePath("/transactions/project");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/admin/lpj/${projectId}`);
    revalidatePath(`/admin/lpj/${projectId}/nota`);
    revalidatePath(`/admin/lpj/${projectId}/pajak`);
    revalidatePath(`/admin/lpj/${projectId}/export`);
  }
  revalidatePath("/admin/lpj");
}

/**
 * Split progresif: kunci BKK berjalan (nominal = total pecah isi),
 * buat BKK berikutnya dengan sisa hingga total = upload Mandor.
 * Maksimal 3 BKK per upload.
 */
export async function splitMandorNotaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoleAdmin();

  const transactionId = String(formData.get("transactionId") ?? "");
  if (!transactionId) return { error: "Nota tidak valid." };

  const current = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      proofUrl: true,
      type: true,
      projectId: true,
      cashSourceId: true,
      categoryId: true,
      createdById: true,
      linkedMandorDisbursementId: true,
      linkedContractorAdvanceId: true,
      isMandorExpense: true,
      isAdminLpjNota: true,
      isSplitParent: true,
      splitParentId: true,
      splitIndex: true,
      breakdownStatus: true,
      breakdownVendor: true,
      expenseLines: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          description: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          workDays: true,
          dailyRate: true,
          amount: true,
          isMaterialAlam: true,
          createdById: true,
        },
      },
    },
  });

  if (!current || !current.isMandorExpense || current.type !== "EXPENSE") {
    return { error: "Bukti Mandor tidak ditemukan." };
  }
  if (current.isSplitParent) {
    return { error: "Ini shell upload — pecah isi di BKK anak." };
  }
  if (current.breakdownStatus === "APPROVED") {
    return { error: "Nota sudah disetujui — buka ulang dulu jika perlu split." };
  }
  if (current.expenseLines.length === 0) {
    return { error: "Isi pecah isi dulu sebelum Split Nota." };
  }

  const lockedAmount = current.expenseLines.reduce((s, l) => s + l.amount, 0);
  if (lockedAmount <= 0) {
    return { error: "Total pecah isi harus lebih dari 0." };
  }

  // Tentukan parent upload + siblings
  const parentId = current.splitParentId ?? current.id;
  const parent = current.splitParentId
    ? await prisma.transaction.findUnique({
        where: { id: current.splitParentId },
        select: {
          id: true,
          amount: true,
          isSplitParent: true,
          isAdminLpjNota: true,
          projectId: true,
          date: true,
          description: true,
          proofUrl: true,
          cashSourceId: true,
          categoryId: true,
          createdById: true,
          linkedMandorDisbursementId: true,
          linkedContractorAdvanceId: true,
        },
      })
    : current;

  if (!parent) return { error: "Upload Mandor tidak ditemukan." };

  const mandorTotal = parent.amount;
  if (mandorTotal <= TAX_THRESHOLD) {
    return {
      error: `Split Nota hanya untuk total Mandor di atas ${TAX_THRESHOLD.toLocaleString("id-ID")}.`,
    };
  }

  const existingChildren = await prisma.transaction.findMany({
    where: { splitParentId: parentId },
    select: { id: true, amount: true, splitIndex: true },
    orderBy: { splitIndex: "asc" },
  });

  const alreadySplit = existingChildren.length > 0 || current.isSplitParent;
  const partCount = alreadySplit
    ? existingChildren.length
    : 1; /* current acts as BKK1 before materializing */

  if (partCount >= MAX_BKK_PARTS) {
    return { error: `Maksimal ${MAX_BKK_PARTS} BKK per nota Mandor.` };
  }

  // Jumlah yang sudah terkunci di BKK lain (bukan current)
  let lockedOthers = 0;
  if (alreadySplit) {
    for (const c of existingChildren) {
      if (c.id === current.id) continue;
      lockedOthers += c.amount;
    }
  }

  if (lockedAmount + lockedOthers >= mandorTotal) {
    return {
      error:
        "Tidak ada sisa untuk BKK berikutnya — total pecah isi sudah menutup nota Mandor. Setujui saja.",
    };
  }

  const nextAmount = mandorTotal - lockedOthers - lockedAmount;
  if (nextAmount <= 0) {
    return { error: "Sisa nominal BKK berikutnya tidak valid." };
  }

  const nextIndex = alreadySplit
    ? Math.max(...existingChildren.map((c) => c.splitIndex ?? 0)) + 1
    : 2;

  if (nextIndex > MAX_BKK_PARTS) {
    return { error: `Maksimal ${MAX_BKK_PARTS} BKK per nota Mandor.` };
  }

  await prisma.$transaction(async (db) => {
    if (!alreadySplit) {
      // Materialisasi: parent → shell; pindahkan lines ke BKK1; buat BKK2
      await db.transaction.update({
        where: { id: parent.id },
        data: {
          isSplitParent: true,
          breakdownStatus: "PENDING",
          breakdownNote: null,
          breakdownVendor: null,
        },
      });

      const bkk1 = await db.transaction.create({
        data: {
          date: parent.date,
          type: "EXPENSE",
          amount: lockedAmount,
          description: `${parent.description} (BKK.1)`.slice(0, 500),
          proofUrl: parent.proofUrl,
          isMandorExpense: true,
          isAdminLpjNota: parent.isAdminLpjNota,
          projectId: parent.projectId,
          cashSourceId: parent.cashSourceId,
          categoryId: parent.categoryId,
          createdById: parent.createdById,
          linkedMandorDisbursementId: parent.linkedMandorDisbursementId,
          linkedContractorAdvanceId: parent.linkedContractorAdvanceId,
          splitParentId: parent.id,
          splitIndex: 1,
          breakdownVendor: current.breakdownVendor,
          breakdownStatus: "PENDING",
        },
      });

      // Pindahkan lines dari parent ke BKK1
      for (const line of current.expenseLines) {
        await db.mandorExpenseLine.update({
          where: { id: line.id },
          data: { transactionId: bkk1.id },
        });
      }

      await db.transaction.create({
        data: {
          date: parent.date,
          type: "EXPENSE",
          amount: nextAmount,
          description: `${parent.description} (BKK.2)`.slice(0, 500),
          proofUrl: parent.proofUrl,
          isMandorExpense: true,
          isAdminLpjNota: parent.isAdminLpjNota,
          projectId: parent.projectId,
          cashSourceId: parent.cashSourceId,
          categoryId: parent.categoryId,
          createdById: parent.createdById,
          linkedMandorDisbursementId: parent.linkedMandorDisbursementId,
          linkedContractorAdvanceId: parent.linkedContractorAdvanceId,
          splitParentId: parent.id,
          splitIndex: 2,
          breakdownStatus: "PENDING",
        },
      });
    } else {
      // Kunci BKK berjalan lalu buat BKK berikutnya
      await db.transaction.update({
        where: { id: current.id },
        data: {
          amount: lockedAmount,
          breakdownStatus: "PENDING",
        },
      });

      await db.transaction.create({
        data: {
          date: parent.date,
          type: "EXPENSE",
          amount: nextAmount,
          description: `${parent.description} (BKK.${nextIndex})`.slice(0, 500),
          proofUrl: parent.proofUrl,
          isMandorExpense: true,
          isAdminLpjNota: parent.isAdminLpjNota,
          projectId: parent.projectId,
          cashSourceId: parent.cashSourceId,
          categoryId: parent.categoryId,
          createdById: parent.createdById,
          linkedMandorDisbursementId: parent.linkedMandorDisbursementId,
          linkedContractorAdvanceId: parent.linkedContractorAdvanceId,
          splitParentId: parent.id,
          splitIndex: nextIndex,
          breakdownStatus: "PENDING",
        },
      });
    }
  });

  revalidateSplit(parent.projectId ?? current.projectId);
  return {
    success: `Split Nota: BKK terkunci ${lockedAmount.toLocaleString("id-ID")}, BKK berikutnya ${nextAmount.toLocaleString("id-ID")}. Lanjut pecah isi.`,
  };
}

/** Batalkan split — hapus semua BKK anak, kembalikan lines ke parent (jika ada di BKK1). */
export async function undoSplitMandorNotaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoleAdmin();

  const parentId = String(formData.get("parentId") ?? "");
  if (!parentId) return { error: "Upload Mandor tidak valid." };

  const parent = await prisma.transaction.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      projectId: true,
      isSplitParent: true,
      isMandorExpense: true,
      amount: true,
    },
  });
  if (!parent || !parent.isMandorExpense || !parent.isSplitParent) {
    return { error: "Bukan upload yang sudah di-split." };
  }

  const children = await prisma.transaction.findMany({
    where: { splitParentId: parentId },
    include: {
      expenseLines: true,
    },
    orderBy: { splitIndex: "asc" },
  });

  if (children.some((c) => c.breakdownStatus === "APPROVED")) {
    return {
      error: "Ada BKK yang sudah disetujui — buka ulang dulu sebelum batal split.",
    };
  }

  // Kembalikan semua lines ke parent (urut BKK)
  await prisma.$transaction(async (db) => {
    for (const child of children) {
      for (const line of child.expenseLines) {
        await db.mandorExpenseLine.update({
          where: { id: line.id },
          data: { transactionId: parentId },
        });
      }
      await db.transaction.delete({ where: { id: child.id } });
    }
    await db.transaction.update({
      where: { id: parentId },
      data: {
        isSplitParent: false,
        breakdownStatus: "PENDING",
        breakdownNote: null,
      },
    });
  });

  revalidateSplit(parent.projectId);
  return { success: "Split dibatalkan — pecah isi kembali ke satu nota." };
}
