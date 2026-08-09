/**
 * Builder Buku Kas Umum — format resmi (pemasukan | pengeluaran berdampingan).
 * Pengeluaran mirip Excel: Status / Qty / Sat / Uraian + No. Bukti BKK.n + Jenis Biaya,
 * plus baris terima/bayar pajak di akhir bulan.
 */

import type { BankMonthBlock } from "@/lib/buku-kas/bank";
import { resolveExpenseLinesForCashBook } from "@/lib/buku-kas/labor-summary";
import { rewriteJasaPerencanaanPengawasan } from "@/lib/lpj/jasa-labels";
import { computeVoucherTax } from "@/lib/lpj/tax-compliance";
import type { TaxLineResult } from "@/lib/lpj/tax-compliance";

function uraian(text: string | null | undefined, fallback: string) {
  return rewriteJasaPerencanaanPengawasan(text?.trim() || fallback);
}

/** Kode Jenis Biaya di kolom pengeluaran BKU. */
export type BkuCostType = "A" | "B" | "C" | "D" | "";

export type BkuExpenseLineInput = {
  description: string;
  quantity?: number | null;
  unit?: string | null;
  amount: number;
  kind?: "MATERIAL" | "LABOR" | string;
  isMaterialAlam?: boolean;
};

export type BkuLedgerTx = {
  id?: string;
  date: Date;
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  /** Laporan Mandor — dipecah ke baris BKK; ikut potong saldo kas di BKU LPJ. */
  isMandorExpense?: boolean;
  /** Pencairan ke Mandor — tidak ditampilkan di BKU (hindari dobel dengan nota). */
  isMandorDisbursement?: boolean;
  isMaterialAlam?: boolean;
  categoryName: string;
  /** Nomor minggu gaji — untuk ringkas uraian LABOR di BKU. */
  laborWeekIndex?: number | null;
  expenseLines?: BkuExpenseLineInput[];
};

export type BkuSideRow = {
  date: Date | null;
  description: string;
  amount: number;
  proofNo?: string;
  costType?: BkuCostType;
  /** Beli | Bayar Ongkos | Jasa | … */
  status?: string;
  quantity?: number | null;
  unit?: string | null;
  /** Baris pajak / ringkasan — bukan item belanja. */
  isTaxRow?: boolean;
};

export type BkuMonthBlock = {
  year: number;
  month: number;
  /** Urutan bulan pembukuan (1-based). */
  monthIndex: number;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  incomes: BkuSideRow[];
  expenses: BkuSideRow[];
  totalIncome: number;
  totalExpense: number;
  /** Saldo Bank di akhir bulan (dari Buku Bank). */
  bankBalance: number;
  /** Saldo Kas Tunai di akhir bulan. */
  cashBalance: number;
  /** bankBalance + cashBalance */
  totalBalance: number;
};

export const BKU_COST_TYPE_NOTES: Array<{ code: BkuCostType; label: string }> =
  [
    { code: "A", label: 'Kelompok "Upah"' },
    { code: "B", label: 'Kelompok "Bahan/Material"' },
    { code: "C", label: 'Kelompok "Alat"' },
    { code: "D", label: 'Kelompok "Biaya Operasional/Admin"' },
  ];

/** Petakan nama kategori / kind baris → kode Jenis Biaya A–D. */
export function mapExpenseCostType(
  categoryName: string,
  kind?: string | null,
): BkuCostType {
  if (kind === "LABOR") return "A";
  if (kind === "MATERIAL") return "B";
  const n = categoryName.trim().toLowerCase();
  if (!n) return "D";
  if (/upah|tenaga|labor|gaji|hok|pekerja|wages|pengawasan/.test(n)) return "A";
  if (/material|bahan/.test(n)) return "B";
  if (/alat|equipment|sewa\s*alat/.test(n)) return "C";
  if (/belanja\s*mandor/.test(n)) return "B";
  return "D";
}

export function formatBkuQty(qty: number | null | undefined) {
  if (qty == null || Number.isNaN(qty)) return "";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(qty);
}

function lineStatus(
  kind: string | undefined,
  description: string,
): string {
  if (kind === "LABOR") return "Bayar Ongkos";
  const d = description.trim();
  if (/^bayar\b/i.test(d)) return "Bayar";
  if (/^jasa\b/i.test(d)) return "Jasa";
  return "Beli";
}

function monthKey(d: Date) {
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function monthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function bankBalanceAtMonth(
  bankBlocks: BankMonthBlock[],
  year: number,
  month: number,
): number {
  if (bankBlocks.length === 0) return 0;
  const key = year * 100 + month;
  let last = 0;
  for (const b of bankBlocks) {
    const bk = b.year * 100 + b.month;
    if (bk > key) break;
    last = b.closingBalance;
    if (bk === key) break;
  }
  const firstKey = bankBlocks[0].year * 100 + bankBlocks[0].month;
  if (key < firstKey) return 0;
  return last;
}

type PendingTax = {
  date: Date;
  buktiNo: string;
  tax: TaxLineResult;
};

function emptyBkuRow(): BkuSideRow {
  return { date: null, description: "", amount: 0 };
}

function padSide(rows: BkuSideRow[], len: number) {
  while (rows.length < len) rows.push(emptyBkuRow());
}

/** Baris bayar pajak di sisi pengeluaran (setelah nota). */
function pushTaxPayRows(
  p: PendingTax,
  expenses: BkuSideRow[],
  totals: { totalExpense: number; monthCashDelta: number },
) {
  if (p.tax.kind === "PPH_FINAL") {
    expenses.push({
      date: p.date,
      description: `Bayar PPh Pasal 4 ayat 2 (3,5%) ${p.buktiNo}`,
      amount: p.tax.pph,
      proofNo: "",
      costType: "",
      status: "",
      isTaxRow: true,
    });
    totals.totalExpense += p.tax.pph;
    totals.monthCashDelta -= p.tax.pph;
    return;
  }

  if (p.tax.kind === "PPN_PPH") {
    if (p.tax.ppn > 0) {
      expenses.push({
        date: p.date,
        description: `Bayar Pajak PPN (11%) ${p.buktiNo}`,
        amount: p.tax.ppn,
        proofNo: "",
        costType: "",
        status: "",
        isTaxRow: true,
      });
      totals.totalExpense += p.tax.ppn;
      totals.monthCashDelta -= p.tax.ppn;
    }
    if (p.tax.pph > 0) {
      expenses.push({
        date: p.date,
        description: `Bayar Pajak PPH (1,5%) ${p.buktiNo}`,
        amount: p.tax.pph,
        proofNo: "",
        costType: "",
        status: "",
        isTaxRow: true,
      });
      totals.totalExpense += p.tax.pph;
      totals.monthCashDelta -= p.tax.pph;
    }
  }
}

/**
 * Susun BKU per bulan dari transaksi ledger + saldo bank (opsional).
 * - Nota Mandor dipecah per baris bahan/upah (No. Bukti BKK.n berkelompok).
 * - Pajak: terima PPh Final di pemasukan; bayar PPN/PPH/PPh Final di pengeluaran.
 */
export function buildBkuMonthBlocks(
  txs: BkuLedgerTx[],
  options?: {
    openingCashBalance?: number;
    bankBlocks?: BankMonthBlock[];
  },
): BkuMonthBlock[] {
  const openingCash = options?.openingCashBalance ?? 0;
  const bankBlocks = options?.bankBlocks ?? [];

  const sorted = [...txs]
    .filter((tx) => !tx.isMandorDisbursement)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const months = new Map<number, BkuLedgerTx[]>();
  for (const tx of sorted) {
    const k = monthKey(tx.date);
    const list = months.get(k) ?? [];
    list.push(tx);
    months.set(k, list);
  }

  const keys = [...months.keys()].sort((a, b) => a - b);
  if (keys.length === 0) {
    if (!openingCash && bankBlocks.length === 0) return [];
    if (bankBlocks.length > 0) {
      keys.push(bankBlocks[0].year * 100 + bankBlocks[0].month);
    } else {
      const now = new Date();
      keys.push(now.getFullYear() * 100 + (now.getMonth() + 1));
    }
  }

  let cashCarry = openingCash;
  let bkkSeq = 0;
  const blocks: BkuMonthBlock[] = [];

  for (const key of keys) {
    const year = Math.floor(key / 100);
    const month = key % 100;
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    const list = months.get(key) ?? [];

    const incomes: BkuSideRow[] = [];
    const expenses: BkuSideRow[] = [];

    if (blocks.length > 0 || cashCarry !== 0) {
      incomes.push({
        date: periodStart,
        description: "Sisa Dana Bulan Lalu",
        amount: cashCarry,
      });
    }

    const totals = {
      totalIncome: incomes.reduce((s, r) => s + r.amount, 0),
      totalExpense: 0,
      monthCashDelta: 0,
    };

    for (const tx of list) {
      const amount = Math.round(tx.amount);

      if (tx.type === "INCOME") {
        incomes.push({
          date: tx.date,
          description: uraian(tx.description, "Penerimaan"),
          amount,
        });
        totals.totalIncome += amount;
        totals.monthCashDelta += amount;
        padSide(expenses, incomes.length);
        continue;
      }

      bkkSeq += 1;
      const buktiNo = `BKK.${bkkSeq}`;
      const lines = resolveExpenseLinesForCashBook({
        description: tx.description,
        laborWeekIndex: tx.laborWeekIndex,
        expenseLines: tx.expenseLines,
      });

      const tax = computeVoucherTax({
        amount,
        description: tx.description,
        categoryName: tx.categoryName,
        isMaterialAlam: tx.isMaterialAlam,
        lines: tx.expenseLines,
      });

      // Samakan tinggi kolom agar "Terima PPh" sejajar dengan baris BKK
      const bkkRowIndex = expenses.length;
      padSide(incomes, bkkRowIndex);

      if (tax.kind === "PPH_FINAL" && tax.pph > 0) {
        incomes.push({
          date: tx.date,
          description: `Terima PPh Pasal 4 ayat 2 (3,5 %) ${buktiNo}`,
          amount: tax.pph,
          isTaxRow: true,
        });
        totals.totalIncome += tax.pph;
        totals.monthCashDelta += tax.pph;
      }

      if (lines) {
        lines.forEach((line, idx) => {
          const lineAmt = Math.round(line.amount);
          expenses.push({
            date: idx === 0 ? tx.date : null,
            description: uraian(line.description || tx.description, "Pengeluaran"),
            amount: lineAmt,
            proofNo: idx === 0 ? buktiNo : "",
            costType: mapExpenseCostType(tx.categoryName, line.kind),
            status: lineStatus(line.kind, line.description),
            quantity: line.quantity ?? null,
            unit: line.unit ?? (line.kind === "LABOR" ? "hari" : null),
          });
          totals.totalExpense += lineAmt;
          totals.monthCashDelta -= lineAmt;
          padSide(incomes, expenses.length);
        });
      } else {
        const kindHint = /upah|pekerja|gaji/i.test(
          `${tx.categoryName} ${tx.description}`,
        )
          ? "LABOR"
          : undefined;
        expenses.push({
          date: tx.date,
          description: uraian(tx.description, "Pengeluaran"),
          amount,
          proofNo: buktiNo,
          costType: mapExpenseCostType(tx.categoryName, kindHint),
          status: lineStatus(kindHint, tx.description),
          quantity: null,
          unit: null,
        });
        totals.totalExpense += amount;
        totals.monthCashDelta -= amount;
        padSide(incomes, expenses.length);
      }

      // Bayar pajak langsung setelah nota
      if (tax.totalTax > 0) {
        pushTaxPayRows(
          { date: tx.date, buktiNo, tax },
          expenses,
          totals,
        );
        padSide(incomes, expenses.length);
      }
    }

    const cashBalance = cashCarry + totals.monthCashDelta;
    const bankBalance = bankBalanceAtMonth(bankBlocks, year, month);

    blocks.push({
      year,
      month,
      monthIndex: blocks.length + 1,
      title: monthTitle(year, month),
      periodStart,
      periodEnd,
      incomes,
      expenses,
      totalIncome: totals.totalIncome,
      totalExpense: totals.totalExpense,
      bankBalance,
      cashBalance,
      totalBalance: bankBalance + cashBalance,
    });

    cashCarry = cashBalance;
  }

  return blocks;
}
