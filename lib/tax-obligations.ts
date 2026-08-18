/**
 * Kewajiban pajak (terhutang → lunas).
 * Dipakai Admin Proyek (Kas Proyek) dan AdminOK (halaman Pajak) bersama.
 */

import { prisma } from "@/lib/prisma";
import {
  computeVoucherTax,
  type TaxLineResult,
} from "@/lib/lpj/tax-compliance";
import type { TaxKind, TaxObligationStatus } from "@/lib/generated/prisma/enums";

export type TaxObligationKind = TaxKind;

function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function kindLabel(kind: TaxKind): string {
  if (kind === "PPN_11") return "PPN 11%";
  if (kind === "PPH_15") return "PPh 1,5%";
  return "PPh Final 3,5%";
}

/** Pecah hasil hitung pajak jadi baris kewajiban per jenis. */
export function taxResultToObligationLines(
  tax: TaxLineResult,
  baseAmount: number,
): Array<{ kind: TaxKind; taxAmount: number; baseAmount: number; label: string }> {
  const lines: Array<{
    kind: TaxKind;
    taxAmount: number;
    baseAmount: number;
    label: string;
  }> = [];
  if (tax.kind === "PPN_PPH") {
    if (tax.ppn > 0) {
      lines.push({
        kind: "PPN_11",
        taxAmount: tax.ppn,
        baseAmount,
        label: `Bayar Pajak PPN (11%) — ${tax.label}`,
      });
    }
    if (tax.pph > 0) {
      lines.push({
        kind: "PPH_15",
        taxAmount: tax.pph,
        baseAmount,
        label: `Bayar Pajak PPH (1,5%) — ${tax.label}`,
      });
    }
  } else if (tax.kind === "PPH_FINAL" && tax.pph > 0) {
    lines.push({
      kind: "PPH_FINAL_35",
      taxAmount: tax.pph,
      baseAmount,
      label: `Bayar PPh Pasal 4 ayat 2 (3,5%) — ${tax.label}`,
    });
  }
  return lines;
}

export type SyncExpenseInput = {
  id: string;
  projectId: string;
  date: Date;
  amount: number;
  description: string;
  categoryName: string;
  isMaterialAlam?: boolean;
  isMandorExpense?: boolean;
  breakdownStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  isSplitParent?: boolean;
  isTaxPayment?: boolean;
  isMandorDisbursement?: boolean;
  isFeeTransfer?: boolean;
  isOwnerPersonal?: boolean;
  lines?: Array<{
    amount: number;
    description?: string | null;
    kind?: string | null;
    isMaterialAlam?: boolean;
  }> | null;
};

/** Sinkron kewajiban untuk satu nota/pengeluaran. */
export async function syncTaxObligationsForExpense(
  tx: SyncExpenseInput,
): Promise<void> {
  if (
    !tx.projectId ||
    tx.isTaxPayment ||
    tx.isMandorDisbursement ||
    tx.isFeeTransfer ||
    tx.isOwnerPersonal ||
    tx.isSplitParent
  ) {
    return;
  }

  const tax = computeVoucherTax({
    amount: tx.amount,
    description: tx.description,
    categoryName: tx.categoryName,
    isMaterialAlam: tx.isMaterialAlam,
    isMandorExpense: tx.isMandorExpense,
    breakdownStatus: tx.breakdownStatus,
    lines: tx.lines,
  });

  const desired = taxResultToObligationLines(tax, Math.round(tx.amount));
  const desiredKinds = new Set(desired.map((d) => d.kind));
  const monthKey = monthKeyFromDate(
    tx.date instanceof Date ? tx.date : new Date(tx.date),
  );

  const existing = await prisma.taxWithholdingLine.findMany({
    where: { transactionId: tx.id },
  });

  for (const row of existing) {
    if (desiredKinds.has(row.kind)) continue;
    // Jangan hapus yang sudah dibayar
    if (row.status === "PAID") continue;
    await prisma.taxWithholdingLine.delete({ where: { id: row.id } });
  }

  for (const line of desired) {
    const prev = existing.find((e) => e.kind === line.kind);
    if (prev) {
      if (prev.status === "PAID") continue;
      await prisma.taxWithholdingLine.update({
        where: { id: prev.id },
        data: {
          baseAmount: line.baseAmount,
          taxAmount: line.taxAmount,
          label: line.label,
          monthKey,
        },
      });
    } else {
      await prisma.taxWithholdingLine.create({
        data: {
          projectId: tx.projectId,
          transactionId: tx.id,
          kind: line.kind,
          baseAmount: line.baseAmount,
          taxAmount: line.taxAmount,
          label: line.label,
          monthKey,
          status: "UNPAID",
        },
      });
    }
  }
}

/** Sinkron semua nota aktif di proyek (idempotent). */
export async function syncProjectTaxObligations(
  projectId: string,
): Promise<{ synced: number }> {
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

  return { synced: expenses.length };
}

export type TaxObligationListItem = {
  id: string;
  kind: TaxKind;
  kindLabel: string;
  taxAmount: number;
  baseAmount: number;
  label: string;
  status: TaxObligationStatus;
  monthKey: string;
  billingId: string | null;
  proofUrl: string | null;
  paidAt: Date | null;
  sourceTransactionId: string | null;
  sourceDescription: string | null;
  sourceDate: Date | null;
};

export async function listTaxObligations(
  projectId: string,
  status?: TaxObligationStatus,
): Promise<TaxObligationListItem[]> {
  const rows = await prisma.taxWithholdingLine.findMany({
    where: {
      projectId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ monthKey: "asc" }, { createdAt: "asc" }],
    include: {
      transaction: {
        select: { id: true, description: true, date: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    kindLabel: kindLabel(r.kind),
    taxAmount: r.taxAmount,
    baseAmount: r.baseAmount,
    label: r.label,
    status: r.status,
    monthKey: r.monthKey,
    billingId: r.billingId,
    proofUrl: r.proofUrl,
    paidAt: r.paidAt,
    sourceTransactionId: r.transactionId,
    sourceDescription: r.transaction?.description ?? null,
    sourceDate: r.transaction?.date ?? null,
  }));
}

export async function sumTaxObligations(
  projectId: string,
  status: TaxObligationStatus,
): Promise<number> {
  const agg = await prisma.taxWithholdingLine.aggregate({
    where: { projectId, status },
    _sum: { taxAmount: true },
  });
  return agg._sum.taxAmount ?? 0;
}

/** ID nota sumber yang pajaknya sudah lunas — untuk BKU/BKT. */
export async function paidTaxSourceIds(
  projectId: string,
): Promise<Set<string>> {
  const rows = await prisma.taxWithholdingLine.findMany({
    where: {
      projectId,
      status: "PAID",
      transactionId: { not: null },
    },
    select: { transactionId: true },
  });
  const set = new Set<string>();
  for (const r of rows) {
    if (r.transactionId) set.add(r.transactionId);
  }
  return set;
}

export function formatTaxKindShort(kind: TaxKind): string {
  return kindLabel(kind);
}
