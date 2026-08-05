/**
 * Builder Buku Kas Umum — format resmi (pemasukan | pengeluaran berdampingan).
 */

import type { BankMonthBlock } from "@/lib/buku-kas/bank";

/** Kode Jenis Biaya di kolom pengeluaran BKU. */
export type BkuCostType = "A" | "B" | "C" | "D" | "";

export type BkuLedgerTx = {
  date: Date;
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  /** Laporan Mandor — tampil di BKU, tidak potong saldo kas. */
  isMandorExpense?: boolean;
  categoryName: string;
};

export type BkuSideRow = {
  date: Date | null;
  description: string;
  amount: number;
  proofNo?: string;
  costType?: BkuCostType;
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

/** Petakan nama kategori transaksi → kode Jenis Biaya A–D. */
export function mapExpenseCostType(categoryName: string): BkuCostType {
  const n = categoryName.trim().toLowerCase();
  if (!n) return "D";
  if (/upah|tenaga|labor|gaji|hok|pekerja|wages/.test(n)) return "A";
  if (/material|bahan/.test(n)) return "B";
  if (/alat|equipment|sewa\s*alat/.test(n)) return "C";
  if (/belanja\s*mandor/.test(n)) return "B";
  return "D";
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
  // Jika bulan target sebelum blok bank pertama → 0
  const firstKey = bankBlocks[0].year * 100 + bankBlocks[0].month;
  if (key < firstKey) return 0;
  return last;
}

/**
 * Susun BKU per bulan dari transaksi ledger + saldo bank (opsional).
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

  const sorted = [...txs].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const months = new Map<number, BkuLedgerTx[]>();
  for (const tx of sorted) {
    const k = monthKey(tx.date);
    const list = months.get(k) ?? [];
    list.push(tx);
    months.set(k, list);
  }

  // Pastikan ada blok untuk bulan yang punya saldo bawa (opening) meski belum ada tx
  const keys = [...months.keys()].sort((a, b) => a - b);
  if (keys.length === 0) {
    if (!openingCash && bankBlocks.length === 0) return [];
    // Pakai bulan pertama bank atau bulan berjalan
    if (bankBlocks.length > 0) {
      keys.push(bankBlocks[0].year * 100 + bankBlocks[0].month);
    } else {
      const now = new Date();
      keys.push(now.getFullYear() * 100 + (now.getMonth() + 1));
    }
  }

  let cashCarry = openingCash;
  let proofSeq = 0;
  const blocks: BkuMonthBlock[] = [];

  for (const key of keys) {
    const year = Math.floor(key / 100);
    const month = key % 100;
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    const list = months.get(key) ?? [];

    const incomes: BkuSideRow[] = [];
    const expenses: BkuSideRow[] = [];

    // Baris bawa saldo kas (boleh negatif) di sisi pemasukan
    if (blocks.length > 0 || cashCarry !== 0) {
      incomes.push({
        date: periodStart,
        description: "Sisa Dana Bulan Lalu",
        amount: cashCarry,
      });
    }

    let monthCashDelta = 0;
    let totalIncome = incomes.reduce((s, r) => s + r.amount, 0);
    let totalExpense = 0;

    for (const tx of list) {
      const amount = Math.round(tx.amount);
      if (tx.type === "INCOME") {
        incomes.push({
          date: tx.date,
          description: tx.description || "Penerimaan",
          amount,
        });
        totalIncome += amount;
        if (!tx.isMandorExpense) monthCashDelta += amount;
      } else {
        proofSeq += 1;
        expenses.push({
          date: tx.date,
          description: tx.description || "Pengeluaran",
          amount,
          proofNo: String(proofSeq).padStart(2, "0"),
          costType: mapExpenseCostType(tx.categoryName),
        });
        totalExpense += amount;
        if (!tx.isMandorExpense) monthCashDelta -= amount;
      }
    }

    // Kas tunai = bawa + penerimaan − pengeluaran (bukan saldo bank).
    const cashBalance = cashCarry + monthCashDelta;
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
      totalIncome,
      totalExpense,
      bankBalance,
      cashBalance,
      totalBalance: bankBalance + cashBalance,
    });

    cashCarry = cashBalance;
  }

  return blocks;
}
