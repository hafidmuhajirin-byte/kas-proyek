import { formatRupiah } from "@/lib/money";

export type LedgerLine = {
  id: string;
  date: Date;
  projectId: string;
  projectName: string;
  location: string;
  sourceName: string;
  kind: string;
  description: string;
  debit: number;
  credit: number;
  /** Jika true, baris tetap tampil tapi tidak mengubah saldo berjalan (mis. masuk kas besar). */
  skipBalance?: boolean;
};

export function buildRunningBalance(
  lines: LedgerLine[],
  opening = 0,
  options?: { honorSkipBalance?: boolean },
): Array<LedgerLine & { balance: number }> {
  const sorted = [...lines].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
  );
  let balance = opening;
  return sorted.map((line) => {
    if (!(options?.honorSkipBalance && line.skipBalance)) {
      balance += line.debit - line.credit;
    }
    return { ...line, balance };
  });
}

export function moneyCell(amount: number, empty = "—") {
  if (amount <= 0) return empty;
  return formatRupiah(amount);
}
