import { isAllLaborLines, laborWeekLabel } from "@/lib/labor-period";
import type { BkuExpenseLineInput } from "@/lib/buku-kas/bku";

/**
 * Untuk BKU/BKT/BKK: pecahan LABOR digabung satu baris
 * "Pembayaran Pekerja Minggu Ke N" — detail nama hanya di pecah isi / absensi.
 */
export function resolveExpenseLinesForCashBook(tx: {
  description: string;
  laborWeekIndex?: number | null;
  expenseLines?: BkuExpenseLineInput[] | null;
}): BkuExpenseLineInput[] | null {
  const lines = tx.expenseLines;
  if (!lines || lines.length === 0) return null;
  if (!isAllLaborLines(lines)) return lines;

  const total = lines.reduce((s, l) => s + Math.round(l.amount), 0);
  const label =
    tx.laborWeekIndex != null && tx.laborWeekIndex > 0
      ? laborWeekLabel(tx.laborWeekIndex)
      : tx.description?.trim() || laborWeekLabel(1);

  return [
    {
      description: label,
      quantity: 1,
      unit: "Ls",
      amount: total,
      kind: "LABOR",
    },
  ];
}
