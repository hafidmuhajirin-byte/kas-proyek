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

/** Validasi total pengambilan vs seluruh dana bank yang sudah cair (70%+30%). */
export function validatePengambilanAgainstBank(
  bankReceivedTotal: number,
  totalPengambilan: number,
): { ok: boolean; remaining: number; overspend: number } {
  const received = Math.max(0, bankReceivedTotal);
  const outflow = Math.max(0, totalPengambilan);
  const remaining = Math.max(0, received - outflow);
  const overspend = Math.max(0, outflow - received);
  return { ok: overspend === 0, remaining, overspend };
}

export type BankTrancheInput = {
  phase: "PHASE_70" | "PHASE_30" | string;
  receivedAmount: number;
  receivedAt: Date | null;
};

/** Dana yang diterima Owner dari User → Kredit Buku Bank (pengambilan). */
export type OwnerReceiptInput = {
  date: Date;
  amount: number;
  description?: string | null;
};

/**
 * Susun mutasi Buku Bank:
 * - Debet: pencairan tranche 70%/30% ke bank User
 * - Kredit: pengambilan = nominal+tanggal dana yang diterima Owner dari User
 */
export function buildBankMutationsFromProject(input: {
  tranches: BankTrancheInput[];
  ownerReceipts: OwnerReceiptInput[];
}): { mutations: BankMutation[]; totalPengambilan: number } {
  const mutations: BankMutation[] = [];

  const t70 = input.tranches.find((t) => t.phase === "PHASE_70");
  const t30 = input.tranches.find((t) => t.phase === "PHASE_30");

  if (t70?.receivedAmount && t70.receivedAt) {
    mutations.push({
      date: t70.receivedAt,
      description: "Uang Masuk Bank Mandiri",
      debit: t70.receivedAmount,
      credit: 0,
    });
  }
  if (t30?.receivedAmount && t30.receivedAt) {
    mutations.push({
      date: t30.receivedAt,
      description: "Pencairan tahap 2 (30%)",
      debit: t30.receivedAmount,
      credit: 0,
    });
  }

  const receipts = [...input.ownerReceipts]
    .filter((r) => r.amount > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalPengambilan = 0;
  receipts.forEach((r, i) => {
    const n = i + 1;
    const tip = r.description?.trim();
    const label =
      tip && !/^pengambilan\s*ke[-\s]?\d+/i.test(tip)
        ? `Pengambilan Ke-${n} (${tip})`
        : `Pengambilan Ke-${n}`;
    mutations.push({
      date: r.date,
      description: label,
      debit: 0,
      credit: Math.round(r.amount),
    });
    totalPengambilan += Math.round(r.amount);
  });

  // No. bukti berurutan menurut tanggal (01, 02, 03…), tanpa loncat.
  mutations
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((m, i) => {
      m.proofNo = String(i + 1).padStart(2, "0");
    });

  return { mutations, totalPengambilan };
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
