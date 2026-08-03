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
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/transactions/${txId}/edit`);
}

export async function createMandorExpenseLineAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  if (!canBreakDownMandorExpense(user)) {
    return { error: "Hanya Admin atau Owner yang dapat memecah nota." };
  }

  const transactionId = String(formData.get("transactionId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "").toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const workDaysRaw = String(formData.get("workDays") ?? "").trim();
  const dailyRate = parseRupiahInput(String(formData.get("dailyRate") ?? "0"));

  if (!transactionId || !description || amount <= 0) {
    return { error: "Nota, keterangan, dan nominal wajib diisi." };
  }
  if (kindRaw !== "MATERIAL" && kindRaw !== "LABOR") {
    return { error: "Jenis harus Bahan atau Pekerja." };
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      amount: true,
      projectId: true,
      isMandorExpense: true,
      expenseLines: { select: { amount: true } },
    },
  });
  if (!tx || !tx.isMandorExpense) {
    return { error: "Bukti Mandor tidak ditemukan." };
  }

  const used = tx.expenseLines.reduce((s, l) => s + l.amount, 0);
  if (used + amount > tx.amount) {
    return {
      error: `Jumlah pecahan melebihi nominal bukti (sisa ${tx.amount - used}).`,
    };
  }

  const quantity = quantityRaw ? Number(quantityRaw) : null;
  const workDays = workDaysRaw ? Number(workDaysRaw) : null;
  if (quantityRaw && Number.isNaN(quantity)) {
    return { error: "Qty tidak valid." };
  }
  if (workDaysRaw && Number.isNaN(workDays)) {
    return { error: "Hari kerja tidak valid." };
  }

  await prisma.mandorExpenseLine.create({
    data: {
      kind: kindRaw,
      description,
      amount,
      quantity: quantity != null && !Number.isNaN(quantity) ? quantity : null,
      unit: kindRaw === "MATERIAL" ? unit : null,
      workDays:
        kindRaw === "LABOR" && workDays != null && !Number.isNaN(workDays)
          ? workDays
          : null,
      dailyRate: kindRaw === "LABOR" && dailyRate > 0 ? dailyRate : null,
      transactionId,
      createdById: user.id,
    },
  });

  revalidateExpense(tx.projectId, transactionId);
  return { success: "Item pecahan disimpan." };
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
      transaction: { select: { projectId: true } },
    },
  });
  if (!line) return;

  await prisma.mandorExpenseLine.delete({ where: { id } });
  revalidateExpense(line.transaction.projectId, line.transactionId);
}
