import {
  computeVoucherTax,
  type TaxLineResult,
} from "@/lib/lpj/tax-compliance";

export type TaxRekapExpenseInput = {
  date: Date;
  amount: number;
  description: string;
  categoryName: string;
  isMaterialAlam?: boolean;
  isMandorExpense?: boolean;
  breakdownStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  lines?: Array<{
    amount: number;
    description?: string | null;
    kind?: string | null;
    isMaterialAlam?: boolean;
  }>;
};

export type TaxRekapMonthRow = {
  month: number; // 1–12
  label: string;
  ppnMasukan: number;
  ppnPengeluaran: number;
  pph22Masukan: number;
  pph22Pengeluaran: number;
  pphFinalMasukan: number;
  pphFinalPengeluaran: number;
  keterangan: string;
};

export type TaxRekapResult = {
  year: number;
  months: TaxRekapMonthRow[];
  totals: {
    ppnMasukan: number;
    ppnPengeluaran: number;
    pph22Masukan: number;
    pph22Pengeluaran: number;
    pphFinalMasukan: number;
    pphFinalPengeluaran: number;
  };
  /** Pajak tertanggung = semua kolom Pengeluaran */
  pajakTertanggung: number;
};

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function emptyMonth(month: number, year: number, keterangan = ""): TaxRekapMonthRow {
  return {
    month,
    label: `${MONTH_NAMES[month - 1]} - ${year}`,
    ppnMasukan: 0,
    ppnPengeluaran: 0,
    pph22Masukan: 0,
    pph22Pengeluaran: 0,
    pphFinalMasukan: 0,
    pphFinalPengeluaran: 0,
    keterangan,
  };
}

function applyTax(row: TaxRekapMonthRow, tax: TaxLineResult) {
  if (tax.kind === "PPN_PPH") {
    // BKU: hanya bayar (pengeluaran) PPN + PPh 22
    row.ppnPengeluaran += tax.ppn;
    row.pph22Pengeluaran += tax.pph;
  } else if (tax.kind === "PPH_FINAL") {
    // BKU: terima = bayar (masukan = pengeluaran)
    row.pphFinalMasukan += tax.pph;
    row.pphFinalPengeluaran += tax.pph;
  }
}

/** Susun 12 bulan rekap pajak untuk satu tahun. */
export function buildTaxRekap(
  expenses: TaxRekapExpenseInput[],
  year: number,
  notesByMonth: Record<number, string> = {},
): TaxRekapResult {
  const months = Array.from({ length: 12 }, (_, i) =>
    emptyMonth(i + 1, year, notesByMonth[i + 1] ?? ""),
  );

  for (const e of expenses) {
    const d = e.date instanceof Date ? e.date : new Date(e.date);
    if (d.getFullYear() !== year) continue;
    const m = d.getMonth(); // 0–11
    const tax = computeVoucherTax({
      amount: e.amount,
      description: e.description,
      categoryName: e.categoryName,
      isMaterialAlam: e.isMaterialAlam,
      isMandorExpense: e.isMandorExpense,
      breakdownStatus: e.breakdownStatus,
      lines: e.lines,
    });
    applyTax(months[m]!, tax);
  }

  const totals = {
    ppnMasukan: 0,
    ppnPengeluaran: 0,
    pph22Masukan: 0,
    pph22Pengeluaran: 0,
    pphFinalMasukan: 0,
    pphFinalPengeluaran: 0,
  };
  for (const row of months) {
    totals.ppnMasukan += row.ppnMasukan;
    totals.ppnPengeluaran += row.ppnPengeluaran;
    totals.pph22Masukan += row.pph22Masukan;
    totals.pph22Pengeluaran += row.pph22Pengeluaran;
    totals.pphFinalMasukan += row.pphFinalMasukan;
    totals.pphFinalPengeluaran += row.pphFinalPengeluaran;
  }

  const pajakTertanggung =
    totals.ppnPengeluaran +
    totals.pph22Pengeluaran +
    totals.pphFinalPengeluaran;

  return { year, months, totals, pajakTertanggung };
}

/** Tahun yang muncul di data pengeluaran (urut desc). */
export function suggestTaxYears(
  expenses: Array<{ date: Date }>,
  fallback = new Date().getFullYear(),
): number[] {
  const set = new Set<number>();
  for (const e of expenses) {
    set.add(
      (e.date instanceof Date ? e.date : new Date(e.date)).getFullYear(),
    );
  }
  if (set.size === 0) set.add(fallback);
  return [...set].sort((a, b) => b - a);
}
