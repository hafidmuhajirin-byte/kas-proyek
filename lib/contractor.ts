import { formatRupiah } from "@/lib/money";

/** Target ideal nilai borongan vs kontrak */
export const CONTRACTOR_TARGET_PERCENT = 70;
/** Batas atas aman — di atas ini keuangan berisiko */
export const CONTRACTOR_MAX_SAFE_PERCENT = 75;

/**
 * Excel ROUNDDOWN(n, -3) — bulatkan ke bawah ke kelipatan Rp1.000.
 */
export function roundDownToThousand(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / 1000) * 1000;
}

export type MandorWorkEstimate = {
  amount: number;
  source: "spk70" | "none";
  /** Kontrak − perencanaan − pengawasan − pengelolaan */
  baseAmount: number;
  contractValue: number;
  perencanaan: number;
  pengawasan: number;
  pengelolaan: number;
  manajemenTotal: number;
  /** (base × 70%) sebelum ROUNDDOWN */
  rawAmount: number;
  /** true jika ketiga pagu manajemen SPK sudah diisi */
  manajemenComplete: boolean;
};

/**
 * Estimasi maksimal pekerjaan Mandor (informasi saja).
 *
 * ROUNDDOWN( (nilai kontrak − perencanaan − pengawasan − pengelolaan) × 70% ; -3 )
 *
 * Jika salah satu dana manajemen SPK belum diisi (> 0), estimasi tidak dihitung.
 */
export function mandorWorkEstimateMax(input: {
  contractValue?: number | null;
  perencanaan?: number | null;
  pengawasan?: number | null;
  pengelolaan?: number | null;
}): MandorWorkEstimate {
  const contractValue = Math.max(0, Math.round(input.contractValue ?? 0));
  const perencanaan = Math.max(0, Math.round(input.perencanaan ?? 0));
  const pengawasan = Math.max(0, Math.round(input.pengawasan ?? 0));
  const pengelolaan = Math.max(0, Math.round(input.pengelolaan ?? 0));
  const manajemenTotal = perencanaan + pengawasan + pengelolaan;
  const manajemenComplete =
    perencanaan > 0 && pengawasan > 0 && pengelolaan > 0;

  const empty = (extra: Partial<MandorWorkEstimate> = {}): MandorWorkEstimate => ({
    amount: 0,
    source: "none",
    baseAmount: 0,
    contractValue,
    perencanaan,
    pengawasan,
    pengelolaan,
    manajemenTotal,
    rawAmount: 0,
    manajemenComplete,
    ...extra,
  });

  if (contractValue <= 0 || !manajemenComplete) {
    return empty();
  }

  const baseAmount = contractValue - manajemenTotal;
  if (baseAmount <= 0) {
    return empty({ baseAmount: 0 });
  }

  const rawAmount = (baseAmount * CONTRACTOR_TARGET_PERCENT) / 100;
  const amount = roundDownToThousand(rawAmount);
  if (amount <= 0) {
    return empty({ baseAmount, rawAmount });
  }
  return {
    amount,
    source: "spk70",
    baseAmount,
    contractValue,
    perencanaan,
    pengawasan,
    pengelolaan,
    manajemenTotal,
    rawAmount,
    manajemenComplete,
  };
}

export type ContractorBudgetBand = "ideal" | "aman" | "berisiko" | "unknown";

export function calcContractorBudgetAmount(
  contractValue: number,
  percent: number,
) {
  if (contractValue <= 0 || percent <= 0) return 0;
  return Math.round((contractValue * percent) / 100);
}

export function contractorSharePercent(
  agreedAmount: number,
  contractValue: number,
) {
  if (contractValue <= 0 || agreedAmount <= 0) return null;
  return Math.round((agreedAmount / contractValue) * 1000) / 10;
}

export function assessContractorBudget(
  agreedAmount: number,
  contractValue: number,
): {
  band: ContractorBudgetBand;
  percent: number | null;
  targetAmount: number;
  maxSafeAmount: number;
  label: string;
} {
  const targetAmount = calcContractorBudgetAmount(
    contractValue,
    CONTRACTOR_TARGET_PERCENT,
  );
  const maxSafeAmount = calcContractorBudgetAmount(
    contractValue,
    CONTRACTOR_MAX_SAFE_PERCENT,
  );
  const percent = contractorSharePercent(agreedAmount, contractValue);

  if (percent == null) {
    return {
      band: "unknown",
      percent,
      targetAmount,
      maxSafeAmount,
      label: `Target borongan ${CONTRACTOR_TARGET_PERCENT}% (aman s.d. ${CONTRACTOR_MAX_SAFE_PERCENT}%)`,
    };
  }

  if (percent <= CONTRACTOR_TARGET_PERCENT) {
    return {
      band: "ideal",
      percent,
      targetAmount,
      maxSafeAmount,
      label: `${percent}% dari kontrak · ideal (≤ ${CONTRACTOR_TARGET_PERCENT}%)`,
    };
  }
  if (percent <= CONTRACTOR_MAX_SAFE_PERCENT) {
    return {
      band: "aman",
      percent,
      targetAmount,
      maxSafeAmount,
      label: `${percent}% dari kontrak · masih aman (≤ ${CONTRACTOR_MAX_SAFE_PERCENT}%)`,
    };
  }
  return {
    band: "berisiko",
    percent,
    targetAmount,
    maxSafeAmount,
    label: `${percent}% dari kontrak · di atas ${CONTRACTOR_MAX_SAFE_PERCENT}% — keuangan berisiko`,
  };
}

export type ContractorStatus = "BELUM" | "BERJALAN" | "LUNAS" | "KURANG_TERMIN";

export type ContractorSummary = {
  totalAdvances: number;
  totalExpenses: number;
  inHand: number;
  shortfall: number;
  remainingCeiling: number;
  agreedAmount: number;
  status: ContractorStatus;
  progressPercent: number;
};

export function summarizeContractor(input: {
  agreedAmount: number;
  /** Pembayaran ke lapangan (Dana ke Mandor) — menggantikan termin lama */
  payments: { amount: number }[];
  expenses: { amount: number }[];
}): ContractorSummary {
  const totalAdvances = input.payments.reduce((sum, a) => sum + a.amount, 0);
  const totalExpenses = input.expenses.reduce((sum, e) => sum + e.amount, 0);
  const inHand = Math.max(0, totalAdvances - totalExpenses);
  const shortfall = Math.max(0, totalExpenses - totalAdvances);
  const remainingCeiling = Math.max(0, input.agreedAmount - totalAdvances);

  let status: ContractorStatus = "BELUM";
  if (totalAdvances > 0 || totalExpenses > 0) {
    if (totalAdvances > 0 && totalAdvances === totalExpenses) {
      status = "LUNAS";
    } else if (shortfall > 0) {
      status = "KURANG_TERMIN";
    } else {
      status = "BERJALAN";
    }
  }

  const progressPercent =
    input.agreedAmount > 0
      ? Math.min(100, Math.round((totalAdvances / input.agreedAmount) * 100))
      : totalAdvances > 0
        ? 100
        : 0;

  return {
    totalAdvances,
    totalExpenses,
    inHand,
    shortfall,
    remainingCeiling,
    agreedAmount: input.agreedAmount,
    status,
    progressPercent,
  };
}

export function allocateAdvanceFunding(
  amount: number,
  projectAvailable: number,
  globalAvailable: number,
): { fromProjectAmount: number; fromGlobalAmount: number; error?: string } {
  if (amount <= 0) {
    return {
      fromProjectAmount: 0,
      fromGlobalAmount: 0,
      error: "Nominal termin harus lebih dari 0.",
    };
  }
  if (amount > globalAvailable) {
    return {
      fromProjectAmount: 0,
      fromGlobalAmount: 0,
      error: `Kas besar tidak cukup (tersedia ${formatRupiah(globalAvailable)}). Wajib setor dana pribadi dulu sebelum termin ${formatRupiah(amount)}.`,
    };
  }

  const projectCash = Math.max(0, projectAvailable);
  const fromProjectAmount = Math.min(amount, projectCash);
  const fromGlobalAmount = amount - fromProjectAmount;

  return { fromProjectAmount, fromGlobalAmount };
}

export const contractorExpenseKindLabels: Record<string, string> = {
  MATERIAL: "Bahan (harian)",
  WAGES: "Upah pekerja (mingguan)",
  OTHER: "Lainnya",
};

export const contractorStatusLabels: Record<ContractorStatus, string> = {
  BELUM: "Belum ada pencairan",
  BERJALAN: "Berjalan",
  LUNAS: "Lunas (bukti = cair)",
  KURANG_TERMIN: "Perlu pencairan berikutnya",
};
