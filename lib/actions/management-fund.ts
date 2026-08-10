"use server";

import { revalidatePath } from "next/cache";
import {
  canBreakDownMandorExpense,
  requireSession,
} from "@/lib/auth";
import { ensureRequiredCategories } from "@/lib/ensure-categories";
import { parseRupiahInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { projectFundCategoryNames } from "@/lib/project-funds";

export type FormState = { error?: string; success?: string };

async function resolveKasTunaiId() {
  const cash = await prisma.cashSource.findFirst({
    where: { OR: [{ name: "Kas Tunai" }, { type: "CASH" }] },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  return cash?.id ?? null;
}

async function resolveManagementCategoryId() {
  await ensureRequiredCategories();
  const name = projectFundCategoryNames.MANAGEMENT;
  const cat = await prisma.category.findFirst({
    where: { type: "EXPENSE", name },
    select: { id: true },
  });
  return cat?.id ?? null;
}

/**
 * Catat breakdown Dana Pengelolaan (Admin/Owner).
 * Setiap baris = 1 pengeluaran Kas Tunai → terbuku di buku kas.
 */
export async function createManagementFundExpensesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  if (!canBreakDownMandorExpense(session)) {
    return { error: "Hanya Owner/Admin yang dapat mencatat dana pengelolaan." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Proyek tidak valid." };

  const dateRaw = String(formData.get("date") ?? "").trim();
  if (!dateRaw) return { error: "Tanggal wajib diisi." };

  const descriptions = formData.getAll("lineDescription").map(String);
  const amounts = formData.getAll("lineAmount").map(String);
  const recipients = formData.getAll("lineRecipient").map(String);

  const lines: { description: string; amount: number; recipient: string }[] =
    [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i]?.trim() ?? "";
    const recipient = recipients[i]?.trim() ?? "";
    const amount = parseRupiahInput(amounts[i] ?? "");
    if (!description && !amount) continue;
    if (!description || !amount || amount <= 0) {
      return { error: `Baris ${i + 1}: isi keterangan dan nominal.` };
    }
    lines.push({ description, amount, recipient });
  }

  if (lines.length === 0) {
    return { error: "Tambahkan minimal satu baris." };
  }

  const [cashSourceId, categoryId, project] = await Promise.all([
    resolveKasTunaiId(),
    resolveManagementCategoryId(),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true },
    }),
  ]);

  if (!project) return { error: "Proyek tidak ditemukan." };
  if (project.status !== "ACTIVE") {
    return { error: "Proyek sudah selesai — tidak bisa menambah pencatatan." };
  }
  if (!cashSourceId) {
    return { error: "Sumber Kas Tunai belum ada. Tambah di menu Sumber kas." };
  }
  if (!categoryId) {
    return { error: "Kategori Dana Pengelolaan belum tersedia." };
  }

  const date = new Date(dateRaw);

  await prisma.$transaction(
    lines.map((line) =>
      prisma.transaction.create({
        data: {
          date,
          type: "EXPENSE",
          amount: line.amount,
          description: line.recipient
            ? `${line.recipient} — ${line.description}`
            : line.description,
          projectId,
          cashSourceId,
          categoryId,
          createdById: session.id,
          isOwnerPersonal: false,
          isFromGlobalCash: false,
          isFeeTransfer: false,
          isMandorExpense: false,
          isMandorDisbursement: false,
        },
      }),
    ),
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/transactions/project");
  revalidatePath("/transactions");
  revalidatePath("/reports");

  return {
    success: `${lines.length} pencatatan Dana Pengelolaan masuk Kas Tunai.`,
  };
}

export async function deleteManagementFundExpenseAction(formData: FormData) {
  const session = await requireSession();
  if (!canBreakDownMandorExpense(session)) return;

  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!id || !projectId) return;

  const catName = projectFundCategoryNames.MANAGEMENT;
  const tx = await prisma.transaction.findFirst({
    where: {
      id,
      projectId,
      type: "EXPENSE",
      category: { name: catName },
      isMandorExpense: false,
    },
    select: { id: true },
  });
  if (!tx) return;

  await prisma.transaction.delete({ where: { id: tx.id } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/transactions/project");
  revalidatePath("/transactions");
  revalidatePath("/reports");
}
