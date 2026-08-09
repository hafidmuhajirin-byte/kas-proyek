/**
 * Builder Buku Kas Tunai — format resmi (satu tabel ledger).
 * Kolom: Tanggal | No. Bukti | Uraian (Status/Qty/Sat/Keterangan/Harga) |
 * Jenis Transaksi (Penerimaan/Pengeluaran) | Saldo (Debet/Kredit)
 *
 * Pajak (sama aturan BKU): terima/bayar PPh Final & bayar PPN/PPH
 * langsung setelah nota terkait.
 */

import { cashBookLineStatus, formatBkuQty } from "@/lib/buku-kas/bku";
import type { BkuExpenseLineInput } from "@/lib/buku-kas/bku";
import { resolveExpenseLinesForCashBook } from "@/lib/buku-kas/labor-summary";
import { rewriteCashBookUraian } from "@/lib/lpj/jasa-labels";
import { computeVoucherTax } from "@/lib/lpj/tax-compliance";
import type { TaxLineResult } from "@/lib/lpj/tax-compliance";

function uraian(text: string | null | undefined, fallback: string) {
  return rewriteCashBookUraian(text?.trim() || fallback);
}

export type BktLedgerTx = {
  id?: string;
  date: Date;
  description: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  isMandorExpense?: boolean;
  isMandorDisbursement?: boolean;
  isMaterialAlam?: boolean;
  categoryName: string;
  /** Sumber kas CASH — BKT hanya mutasi tunai. */
  cashSourceType?: string;
  laborWeekIndex?: number | null;
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
  /** Baris pajak — bukan item belanja. */
  isTaxRow?: boolean;
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

function pushBalance(balance: number): Pick<BktRow, "saldoDebet" | "saldoKredit"> {
  return {
    saldoDebet: balance >= 0 ? balance : 0,
    saldoKredit: balance < 0 ? Math.abs(balance) : 0,
  };
}

type BktTotals = {
  balance: number;
  totalIncome: number;
  totalExpense: number;
};

function pushTaxReceiveRow(
  rows: BktRow[],
  totals: BktTotals,
  p: { date: Date; buktiNo: string; tax: TaxLineResult },
) {
  if (p.tax.kind !== "PPH_FINAL" || p.tax.pph <= 0) return;
  totals.balance += p.tax.pph;
  totals.totalIncome += p.tax.pph;
  rows.push({
    date: p.date,
    proofNo: "",
    status: "",
    quantity: null,
    unit: null,
    description: `Terima PPh Pasal 4 ayat 2 (3,5 %) ${p.buktiNo}`,
    unitPrice: null,
    income: p.tax.pph,
    expense: 0,
    isTaxRow: true,
    ...pushBalance(totals.balance),
  });
}

function pushTaxPayRows(
  rows: BktRow[],
  totals: BktTotals,
  p: { date: Date; buktiNo: string; tax: TaxLineResult },
) {
  if (p.tax.kind === "PPH_FINAL" && p.tax.pph > 0) {
    totals.balance -= p.tax.pph;
    totals.totalExpense += p.tax.pph;
    rows.push({
      date: p.date,
      proofNo: "",
      status: "Bayar",
      quantity: null,
      unit: null,
      description: `Bayar PPh Pasal 4 ayat 2 (3,5%) ${p.buktiNo}`,
      unitPrice: null,
      income: 0,
      expense: p.tax.pph,
      isTaxRow: true,
      ...pushBalance(totals.balance),
    });
    return;
  }

  if (p.tax.kind !== "PPN_PPH") return;

  if (p.tax.ppn > 0) {
    totals.balance -= p.tax.ppn;
    totals.totalExpense += p.tax.ppn;
    rows.push({
      date: p.date,
      proofNo: "",
      status: "Bayar",
      quantity: null,
      unit: null,
      description: `Bayar Pajak PPN (11%) ${p.buktiNo}`,
      unitPrice: null,
      income: 0,
      expense: p.tax.ppn,
      isTaxRow: true,
      ...pushBalance(totals.balance),
    });
  }
  if (p.tax.pph > 0) {
    totals.balance -= p.tax.pph;
    totals.totalExpense += p.tax.pph;
    rows.push({
      date: p.date,
      proofNo: "",
      status: "Bayar",
      quantity: null,
      unit: null,
      description: `Bayar Pajak PPH (1,5%) ${p.buktiNo}`,
      unitPrice: null,
      income: 0,
      expense: p.tax.pph,
      isTaxRow: true,
      ...pushBalance(totals.balance),
    });
  }
}

/**
 * Susun BKT per bulan dari mutasi tunai + pengambilan.
 * Pencairan Mandor tidak ditampilkan (hindari dobel dengan nota).
 * Pajak potong kas tunai langsung setelah nota terkait.
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
    const totals: BktTotals = {
      balance: cashCarry,
      totalIncome: 0,
      totalExpense: 0,
    };

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
          ...pushBalance(totals.balance),
        });
        if (cashCarry > 0) totals.totalIncome += cashCarry;
        else totals.totalExpense += Math.abs(cashCarry);
      }
    }

    for (const tx of list) {
      const amount = Math.round(tx.amount);

      if (tx.type === "INCOME") {
        totals.balance += amount;
        totals.totalIncome += amount;
        rows.push({
          date: tx.date,
          proofNo: "",
          status: "",
          quantity: null,
          unit: null,
          description: uraian(tx.description, "Penerimaan"),
          unitPrice: null,
          income: amount,
          expense: 0,
          ...pushBalance(totals.balance),
        });
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

      if (lines) {
        lines.forEach((line, idx) => {
          const lineAmt = Math.round(line.amount);
          totals.balance -= lineAmt;
          totals.totalExpense += lineAmt;
          const qty = line.quantity ?? null;
          const unitPrice =
            qty && qty > 0 ? Math.round(lineAmt / qty) : null;
          rows.push({
            date: idx === 0 ? tx.date : null,
            proofNo: idx === 0 ? buktiNo : "",
            status: cashBookLineStatus(
              line.kind,
              line.description || tx.description,
              tx.categoryName,
            ),
            quantity: qty,
            unit: line.unit ?? (line.kind === "LABOR" ? "hari" : null),
            description: uraian(line.description || tx.description, "Pengeluaran"),
            unitPrice,
            income: 0,
            expense: lineAmt,
            ...pushBalance(totals.balance),
          });
        });
      } else {
        totals.balance -= amount;
        totals.totalExpense += amount;
        const kindHint = /upah|pekerja|gaji/i.test(
          `${tx.categoryName} ${tx.description}`,
        )
          ? "LABOR"
          : undefined;
        rows.push({
          date: tx.date,
          proofNo: buktiNo,
          status: cashBookLineStatus(kindHint, tx.description, tx.categoryName),
          quantity: null,
          unit: null,
          description: uraian(tx.description, "Pengeluaran"),
          unitPrice: null,
          income: 0,
          expense: amount,
          ...pushBalance(totals.balance),
        });
      }

      // Pajak langsung setelah nota: terima PPh Final (jika ada), lalu bayar
      if (tax.totalTax > 0) {
        pushTaxReceiveRow(rows, totals, { date: tx.date, buktiNo, tax });
        pushTaxPayRows(rows, totals, { date: tx.date, buktiNo, tax });
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
      totalIncome: totals.totalIncome,
      totalExpense: totals.totalExpense,
      closingBalance: totals.balance,
    });
    cashCarry = totals.balance;
  }

  return blocks;
}

export { formatBkuQty as formatBktQty };
