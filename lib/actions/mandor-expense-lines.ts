"use server";

import { revalidatePath } from "next/cache";
import {
  canBreakDownMandorExpense,
  requireSession,
} from "@/lib/auth";
import { parseRupiahInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

function revalidateExpense(projectId: string | null | undefined, txId: string) {
  revalidatePath("/transactions");
  revalidatePath("/transactions/project");
  revalidatePath("/mandor");
  revalidatePath("/admin/lpj");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/admin/lpj/${projectId}`);
    revalidatePath(`/admin/lpj/${projectId}/nota`);
    revalidatePath(`/admin/lpj/${projectId}/pajak`);
  }
  revalidatePath(`/transactions/${txId}/edit`);
}

type LinePayload = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
};

function parseLinesJson(raw: string): LinePayload[] | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const lines: LinePayload[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const description = String(r.description ?? "").trim();
      const amount = Number(r.amount ?? 0);
      if (!description || !(amount > 0)) continue;
      const quantity =
        r.quantity == null || r.quantity === ""
          ? null
          : Number(r.quantity);
      const unit = String(r.unit ?? "").trim() || null;
      const unitPrice =
        r.unitPrice == null || r.unitPrice === ""
          ? null
          : Number(r.unitPrice);
      if (quantity != null && Number.isNaN(quantity)) return null;
      if (unitPrice != null && (Number.isNaN(unitPrice) || unitPrice < 0))
        return null;
      lines.push({
        description,
        quantity,
        unit,
        unitPrice:
          unitPrice != null && !Number.isNaN(unitPrice)
            ? Math.round(unitPrice)
            : null,
        amount: Math.round(amount),
      });
    }
    return lines;
  } catch {
    return null;
  }
}

/** Simpan ulang seluruh pecahan (tabel) untuk satu bukti. */
export async function saveMandorExpenseBreakdownAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  if (!canBreakDownMandorExpense(user)) {
    return { error: "Hanya Admin atau Owner yang dapat memecah nota." };
  }

  const transactionId = String(formData.get("transactionId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "").toUpperCase();
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const lines = parseLinesJson(String(formData.get("linesJson") ?? "[]"));

  if (!transactionId) return { error: "Nota tidak valid." };
  if (kindRaw !== "MATERIAL" && kindRaw !== "LABOR") {
    return { error: "Pilih jenis: bahan atau pekerja." };
  }
  if (!lines || lines.length === 0) {
    return { error: "Minimal satu baris pecahan." };
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      amount: true,
      projectId: true,
      isMandorExpense: true,
      isSplitParent: true,
      breakdownStatus: true,
    },
  });
  if (!tx || !tx.isMandorExpense) {
    return { error: "Bukti Mandor tidak ditemukan." };
  }
  if (tx.isSplitParent) {
    return {
      error: "Upload sudah di-split — pecah isi di masing-masing BKK.",
    };
  }
  if (tx.breakdownStatus === "APPROVED") {
    return { error: "Nota sudah disetujui. Buka ulang dulu jika perlu ubah." };
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  if (total > tx.amount) {
    return {
      error: `Total pecahan ${total.toLocaleString("id-ID")} melebihi nota ${tx.amount.toLocaleString("id-ID")}.`,
    };
  }

  await prisma.$transaction(async (db) => {
    await db.mandorExpenseLine.deleteMany({ where: { transactionId } });
    await db.mandorExpenseLine.createMany({
      data: lines.map((l) => ({
        kind: kindRaw as "MATERIAL" | "LABOR",
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        workDays: kindRaw === "LABOR" ? l.quantity : null,
        dailyRate: kindRaw === "LABOR" ? l.unitPrice : null,
        amount: l.amount,
        transactionId,
        createdById: user.id,
      })),
    });
    await db.transaction.update({
      where: { id: transactionId },
      data: {
        breakdownVendor: kindRaw === "MATERIAL" ? vendor : null,
        breakdownStatus: "PENDING",
        breakdownNote: null,
      },
    });
  });

  revalidateExpense(tx.projectId, transactionId);
  const match = total === tx.amount;
  return {
    success: match
      ? "Pecahan tersimpan — total sesuai nota. Anda bisa setujui."
      : `Pecahan tersimpan. Total ${total.toLocaleString("id-ID")} belum sama dengan nota ${tx.amount.toLocaleString("id-ID")}.`,
  };
}

export async function approveMandorExpenseBreakdownAction(
  formData: FormData,
): Promise<void> {
  const user = await requireSession();
  if (!canBreakDownMandorExpense(user)) return;

  const transactionId = String(formData.get("transactionId") ?? "");
  if (!transactionId) return;

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      amount: true,
      projectId: true,
      isMandorExpense: true,
      isSplitParent: true,
      splitParentId: true,
      expenseLines: { select: { amount: true } },
    },
  });
  if (!tx || !tx.isMandorExpense || tx.isSplitParent) return;

  const total = tx.expenseLines.reduce((s, l) => s + l.amount, 0);
  if (tx.expenseLines.length === 0 || total !== tx.amount) return;

  // Jika bagian split: jumlah semua BKK harus = total upload Mandor
  if (tx.splitParentId) {
    const parent = await prisma.transaction.findUnique({
      where: { id: tx.splitParentId },
      select: { amount: true },
    });
    const siblings = await prisma.transaction.findMany({
      where: { splitParentId: tx.splitParentId },
      select: { amount: true },
    });
    const sumParts = siblings.reduce((s, c) => s + c.amount, 0);
    if (!parent || sumParts !== parent.amount) return;
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { breakdownStatus: "APPROVED", breakdownNote: null },
  });

  // Jika semua BKK anak sudah approved, tandai parent shell juga
  if (tx.splitParentId) {
    const siblings = await prisma.transaction.findMany({
      where: { splitParentId: tx.splitParentId },
      select: { breakdownStatus: true },
    });
    if (siblings.every((s) => s.breakdownStatus === "APPROVED")) {
      await prisma.transaction.update({
        where: { id: tx.splitParentId },
        data: { breakdownStatus: "APPROVED", breakdownNote: null },
      });
    }
  }

  revalidateExpense(tx.projectId, transactionId);
}

export async function rejectMandorExpenseBreakdownAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  if (!canBreakDownMandorExpense(user)) {
    return { error: "Tidak diizinkan." };
  }

  const transactionId = String(formData.get("transactionId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!transactionId) return { error: "Nota tidak valid." };
  if (!note) {
    return {
      error: "Tulis alasan tolak agar Mandor tahu foto/nota yang perlu diganti.",
    };
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      projectId: true,
      isMandorExpense: true,
      isSplitParent: true,
      splitParentId: true,
    },
  });
  if (!tx || !tx.isMandorExpense) return { error: "Bukti tidak ditemukan." };

  // Tolak upload Mandor (parent) + semua BKK agar notifikasi sampai ke Mandor
  const rootId = tx.isSplitParent
    ? tx.id
    : (tx.splitParentId ?? tx.id);

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: rootId },
      data: { breakdownStatus: "REJECTED", breakdownNote: note },
    }),
    prisma.transaction.updateMany({
      where: { splitParentId: rootId },
      data: { breakdownStatus: "REJECTED", breakdownNote: note },
    }),
  ]);

  revalidateExpense(tx.projectId, transactionId);
  return {
    success:
      "Nota ditolak. Mandor akan melihat permintaan ganti bukti nota agar sesuai.",
  };
}

export async function reopenMandorExpenseBreakdownAction(
  formData: FormData,
): Promise<void> {
  const user = await requireSession();
  if (!canBreakDownMandorExpense(user)) return;

  const transactionId = String(formData.get("transactionId") ?? "");
  if (!transactionId) return;

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true, projectId: true, isMandorExpense: true },
  });
  if (!tx || !tx.isMandorExpense) return;

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { breakdownStatus: "PENDING", breakdownNote: null },
  });

  revalidateExpense(tx.projectId, transactionId);
}

/** @deprecated — gunakan saveMandorExpenseBreakdownAction */
export async function createMandorExpenseLineAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Adapt single-line add into save flow for compatibility
  const transactionId = String(formData.get("transactionId") ?? "");
  const kind = String(formData.get("kind") ?? "MATERIAL");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const unitPrice = parseRupiahInput(String(formData.get("unitPrice") ?? "0"));
  const workDaysRaw = String(formData.get("workDays") ?? "").trim();
  const dailyRate = parseRupiahInput(String(formData.get("dailyRate") ?? "0"));

  const qty = quantityRaw
    ? Number(quantityRaw)
    : workDaysRaw
      ? Number(workDaysRaw)
      : null;
  const price =
    unitPrice > 0 ? unitPrice : dailyRate > 0 ? dailyRate : null;

  const existing = await prisma.mandorExpenseLine.findMany({
    where: { transactionId },
    select: {
      description: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      amount: true,
      kind: true,
    },
  });

  const lines = [
    ...existing.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      amount: l.amount,
    })),
    {
      description,
      quantity: qty != null && !Number.isNaN(qty) ? qty : null,
      unit: unit || (kind === "LABOR" ? "hari" : null),
      unitPrice: price,
      amount,
    },
  ];

  const fd = new FormData();
  fd.set("transactionId", transactionId);
  fd.set("kind", existing[0]?.kind ?? kind);
  fd.set("vendor", String(formData.get("vendor") ?? ""));
  fd.set("linesJson", JSON.stringify(lines));
  return saveMandorExpenseBreakdownAction({}, fd);
}

export async function deleteMandorExpenseLineAction(
  formData: FormData,
): Promise<void> {
  const user = await requireSession();
  if (!canBreakDownMandorExpense(user)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const line = await prisma.mandorExpenseLine.findUnique({
    where: { id },
    select: {
      id: true,
      transactionId: true,
      transaction: {
        select: { projectId: true, breakdownStatus: true },
      },
    },
  });
  if (!line) return;
  if (line.transaction.breakdownStatus === "APPROVED") return;

  await prisma.mandorExpenseLine.delete({ where: { id } });

  const remaining = await prisma.mandorExpenseLine.count({
    where: { transactionId: line.transactionId },
  });
  if (remaining === 0) {
    await prisma.transaction.update({
      where: { id: line.transactionId },
      data: { breakdownStatus: "PENDING", breakdownNote: null },
    });
  }

  revalidateExpense(line.transaction.projectId, line.transactionId);
}
