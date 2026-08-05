/**
 * Builder Buku Bank — blok bulanan dari pencairan 70/30 + pengambilan.
 */

export type BankMutation = {
  date: Date;
  description: string;
  proofNo?: string;
  /** Penerimaan (debet) */
  debit: number;
  /** Pengeluaran / pengambilan (kredit) */
  credit: number;
};

export type BankMonthBlock = {
  year: number;
  month: number; // 1-12
  title: string;
  openingBalance: number;
  rows: Array<{
    no: number;
    date: Date | null;
    description: string;
    proofNo: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
};

export type BankTrancheInfo = {
  phase70Planned: number;
  phase70Received: number;
  phase30Planned: number;
  phase30Received: number;
};

export function plannedTranchesFromContract(contractValue: number) {
  const v = Math.max(0, Math.round(contractValue));
  const phase70 = Math.round(v * 0.7);
  const phase30 = v - phase70;
  return { phase70, phase30 };
}

/** Validasi: pengeluaran fase 1 tidak melebihi pencairan 70% yang sudah diterima. */
export function validatePhase1Spend(
  phase70Received: number,
  phase1Outflow: number,
): { ok: boolean; remaining: number; overspend: number } {
  const received = Math.max(0, phase70Received);
  const outflow = Math.max(0, phase1Outflow);
  const remaining = Math.max(0, received - outflow);
  const overspend = Math.max(0, outflow - received);
  return { ok: overspend === 0, remaining, overspend };
}

function monthKey(d: Date) {
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function monthTitle(year: number, month: number) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/**
 * Bangun blok Buku Bank per bulan.
 * Baris pertama tiap bulan (kec. bulan paling awal opsional): sisa saldo bulan kemarin.
 */
export function buildBankMonthBlocks(
  mutations: BankMutation[],
  options?: { openingBalance?: number },
): BankMonthBlock[] {
  const sorted = [...mutations].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  if (sorted.length === 0 && !(options?.openingBalance)) return [];

  const months = new Map<number, BankMutation[]>();
  for (const m of sorted) {
    const k = monthKey(m.date);
    const list = months.get(k) ?? [];
    list.push(m);
    months.set(k, list);
  }

  const keys = [...months.keys()].sort((a, b) => a - b);
  let carry = Math.max(0, options?.openingBalance ?? 0);
  const blocks: BankMonthBlock[] = [];

  for (const key of keys) {
    const year = Math.floor(key / 100);
    const month = key % 100;
    const rows: BankMonthBlock["rows"] = [];
    let balance = carry;
    let totalDebit = 0;
    let totalCredit = 0;
    let no = 1;

    if (carry > 0 || blocks.length > 0) {
      rows.push({
        no: no++,
        date: new Date(year, month - 1, 1),
        description: "Sisa Saldo Bulan Kemarin",
        proofNo: "",
        debit: carry,
        credit: 0,
        balance: carry,
      });
      totalDebit += carry;
    }

    for (const m of months.get(key) ?? []) {
      const debit = Math.max(0, Math.round(m.debit));
      const credit = Math.max(0, Math.round(m.credit));
      balance = balance + debit - credit;
      totalDebit += debit;
      totalCredit += credit;
      rows.push({
        no: no++,
        date: m.date,
        description: m.description,
        proofNo: m.proofNo ?? "",
        debit,
        credit,
        balance,
      });
    }

    const closingBalance = totalDebit - totalCredit;
    blocks.push({
      year,
      month,
      title: `Bulan ${monthTitle(year, month)}`,
      openingBalance: carry,
      rows,
      totalDebit,
      totalCredit,
      closingBalance,
    });
    carry = closingBalance;
  }

  return blocks;
}
