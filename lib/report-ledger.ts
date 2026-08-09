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

/** Debit/kredit yang memengaruhi kas — abaikan baris laporan (skipBalance). */
export function sumCashMovements(
  lines: Array<Pick<LedgerLine, "debit" | "credit" | "skipBalance">>,
) {
  return lines.reduce(
    (acc, row) => {
      if (row.skipBalance) return acc;
      return {
        debit: acc.debit + row.debit,
        credit: acc.credit + row.credit,
      };
    },
    { debit: 0, credit: 0 },
  );
}

export function moneyCell(amount: number, empty = "—") {
  if (amount <= 0) return empty;
  return formatRupiah(amount);
}
