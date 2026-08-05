/**
 * Builder Buku Kas Tunai — format resmi (satu tabel ledger).
 * Kolom: Tanggal | No. Bukti | Uraian (Status/Qty/Sat/Keterangan/Harga) |
 * Jenis Transaksi (Penerimaan/Pengeluaran) | Saldo (Debet/Kredit)
 */

import { formatBkuQty } from "@/lib/buku-kas/bku";
import type { BkuExpenseLineInput } from "@/lib/buku-kas/bku";

export type BktLedgerTx = {
  id?: string;
  date: Date;
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  isMandorExpense?: boolean;
  isMandorDisbursement?: boolean;
  categoryName: string;
  /** Sumber kas CASH — BKT hanya mutasi tunai. */
  cashSourceType?: string;
  expenseLines?: BkuExpenseLineInput[];
  unitPrice?: number | null;
};

export type BktRow = {
  date: Date | null;
  proofNo: string;
  status: string;
  quantity: number | null;
  unit: string | null;
  description: string;
  unitPrice: number | null;
  income: number;
  expense: number;
  saldoDebet: number;
  saldoKredit: number;
};

export type BktMonthBlock = {
  year: number;
  month: number;
  monthIndex: number;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  rows: BktRow[];
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
};

function monthKey(d: Date) {
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function monthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function lineStatus(kind: string | undefined, description: string): string {
  if (kind === "LABOR") return "Bayar Ongkos";
  const d = description.trim();
  if (/^bayar\b/i.test(d)) return "Bayar";
  if (/^jasa\b/i.test(d)) return "Jasa";
  return "Beli";
}

function pushBalance(balance: number): Pick<BktRow, "saldoDebet" | "saldoKredit"> {
  return {
    saldoDebet: balance >= 0 ? balance : 0,
    saldoKredit: balance < 0 ? Math.abs(balance) : 0,
  };
}

/**
 * Susun BKT per bulan dari mutasi tunai + pengambilan.
 * Pencairan Mandor tidak ditampilkan (hindari dobel dengan nota).
 */
export function buildBktMonthBlocks(
  txs: BktLedgerTx[],
  options?: { openingCashBalance?: number },
): BktMonthBlock[] {
  const opening = options?.openingCashBalance ?? 0;

  const sorted = [...txs]
    .filter((tx) => !tx.isMandorDisbursement)
    .filter((tx) => {
      // Prefer sumber CASH; jika flag tidak ada, ikutkan (data LPJ)
      if (!tx.cashSourceType) return true;
      return tx.cashSourceType === "CASH";
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const months = new Map<number, BktLedgerTx[]>();
  for (const tx of sorted) {
    const k = monthKey(tx.date);
    const list = months.get(k) ?? [];
    list.push(tx);
    months.set(k, list);
  }

  const keys = [...months.keys()].sort((a, b) => a - b);
  if (keys.length === 0) {
    if (!opening) return [];
    const now = new Date();
    keys.push(now.getFullYear() * 100 + (now.getMonth() + 1));
  }

  let cashCarry = opening;
  let bkkSeq = 0;
  const blocks: BktMonthBlock[] = [];

  for (const key of keys) {
    const year = Math.floor(key / 100);
    const month = key % 100;
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    const list = months.get(key) ?? [];

    const rows: BktRow[] = [];
    let balance = cashCarry;
    let totalIncome = 0;
    let totalExpense = 0;

    if (blocks.length > 0 || cashCarry !== 0) {
      // Sisa kas bulan lalu sebagai penerimaan awal (opsional di template sering berupa pengambilan)
      // Di BKT resmi biasanya dimulai dari Pengambilan; sisa hanya jika carry ≠ 0 antar bulan
      if (blocks.length > 0) {
        rows.push({
          date: periodStart,
          proofNo: "",
          status: "",
          quantity: null,
          unit: null,
          description: "Sisa Saldo Bulan Lalu",
          unitPrice: null,
          income: cashCarry > 0 ? cashCarry : 0,
          expense: cashCarry < 0 ? Math.abs(cashCarry) : 0,
          ...pushBalance(balance),
        });
        if (cashCarry > 0) totalIncome += cashCarry;
        else totalExpense += Math.abs(cashCarry);
      }
    }

    for (const tx of list) {
      const amount = Math.round(tx.amount);

      if (tx.type === "INCOME") {
        balance += amount;
        totalIncome += amount;
        rows.push({
          date: tx.date,
          proofNo: "",
          status: "",
          quantity: null,
          unit: null,
          description: tx.description || "Penerimaan",
          unitPrice: null,
          income: amount,
          expense: 0,
          ...pushBalance(balance),
        });
        continue;
      }

      bkkSeq += 1;
      const buktiNo = `BKK.${bkkSeq}`;
      const lines =
        tx.expenseLines && tx.expenseLines.length > 0
          ? tx.expenseLines
          : null;

      if (lines) {
        lines.forEach((line, idx) => {
          const lineAmt = Math.round(line.amount);
          balance -= lineAmt;
          totalExpense += lineAmt;
          const qty = line.quantity ?? null;
          const unitPrice =
            qty && qty > 0 ? Math.round(lineAmt / qty) : null;
          rows.push({
            date: idx === 0 ? tx.date : null,
            proofNo: idx === 0 ? buktiNo : "",
            status: lineStatus(line.kind, line.description),
            quantity: qty,
            unit: line.unit ?? (line.kind === "LABOR" ? "hari" : null),
            description: line.description || tx.description || "Pengeluaran",
            unitPrice,
            income: 0,
            expense: lineAmt,
            ...pushBalance(balance),
          });
        });
      } else {
        balance -= amount;
        totalExpense += amount;
        const kindHint = /upah|pekerja|gaji/i.test(
          `${tx.categoryName} ${tx.description}`,
        )
          ? "LABOR"
          : undefined;
        rows.push({
          date: tx.date,
          proofNo: buktiNo,
          status: lineStatus(kindHint, tx.description),
          quantity: null,
          unit: null,
          description: tx.description || "Pengeluaran",
          unitPrice: null,
          income: 0,
          expense: amount,
          ...pushBalance(balance),
        });
      }
    }

    blocks.push({
      year,
      month,
      monthIndex: blocks.length + 1,
      title: monthTitle(year, month),
      periodStart,
      periodEnd,
      rows,
      totalIncome,
      totalExpense,
      closingBalance: balance,
    });
    cashCarry = balance;
  }

  return blocks;
}

export { formatBkuQty as formatBktQty };
