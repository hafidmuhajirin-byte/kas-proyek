/**
 * Estimasi keuntungan proyek.
 * Acuan margin = fee proyek ~2.5% dari pendapatan.
 * Keuntungan realisasi bisa bertambah seiring pembayaran masuk / biaya terkendali.
 */

/** Fee / margin acuan proyek (%) */
export const PROJECT_FEE_PERCENT = 2.5;

/** Pita banding tipis di sekitar fee (untuk indikator warna) */
export const PROFIT_MARGIN_BENCHMARK = {
  low: 2,
  high: 3,
  target: PROJECT_FEE_PERCENT,
} as const;

export type ProjectProfitInput = {
  contractValue: number;
  billingMode: "ON_REQUEST" | "TERMIN_PLAN" | "PAY_AT_END";
  workCompletedValue: number;
  clientIncome: number;
  /** Biaya operasional terpakai (tanpa ambil owner / sisa sekolah) */
  operatingExpense: number;
  contractorAdvances: number;
  /** Sisa rencana 5 pos dana: sum(max(0, planned − spent)) */
  remainingPlannedFunds: number;
  /** 0–15 (persen) kontinjensi risiko atas biaya */
  contingencyPercent: number;
};

export type ProjectProfitResult = {
  revenueBase: number;
  clientIncome: number;
  costUsed: number;
  remainingPlannedFunds: number;
  contingencyAmount: number;
  contingencyPercent: number;
  /** Target fee = pendapatan acuan × 2.5% */
  feeTargetProfit: number;
  realizedProfit: number;
  maxProjectedProfit: number;
  remainingPotential: number;
  realizedMarginPercent: number | null;
  projectedMarginPercent: number | null;
  marginBand: "below" | "within" | "above" | "n/a";
};

export function calcRevenueBase(input: {
  contractValue: number;
  billingMode: ProjectProfitInput["billingMode"];
  workCompletedValue: number;
  clientIncome: number;
}) {
  if (input.contractValue > 0) return input.contractValue;
  if (input.billingMode === "PAY_AT_END") return input.workCompletedValue;
  return Math.max(input.contractValue, input.clientIncome);
}

export function calcProjectProfit(
  input: ProjectProfitInput,
): ProjectProfitResult {
  const contingencyPercent = Math.min(
    15,
    Math.max(0, Number(input.contingencyPercent) || 0),
  );

  const revenueBase = calcRevenueBase(input);
  const costUsed = input.operatingExpense + input.contractorAdvances;
  const remainingPlannedFunds = Math.max(0, input.remainingPlannedFunds);
  const contingencyBase = costUsed + remainingPlannedFunds;
  const contingencyAmount = Math.round(
    (contingencyBase * contingencyPercent) / 100,
  );

  const feeTargetProfit = Math.round(
    (revenueBase * PROJECT_FEE_PERCENT) / 100,
  );

  const realizedProfit = input.clientIncome - costUsed;
  const maxProjectedProfit =
    revenueBase - costUsed - remainingPlannedFunds - contingencyAmount;
  const remainingPotential = maxProjectedProfit - realizedProfit;

  const realizedMarginPercent =
    input.clientIncome > 0
      ? Math.round((realizedProfit / input.clientIncome) * 1000) / 10
      : null;
  const projectedMarginPercent =
    revenueBase > 0
      ? Math.round((maxProjectedProfit / revenueBase) * 1000) / 10
      : null;

  let marginBand: ProjectProfitResult["marginBand"] = "n/a";
  if (projectedMarginPercent != null) {
    if (projectedMarginPercent < PROFIT_MARGIN_BENCHMARK.low)
      marginBand = "below";
    else if (projectedMarginPercent <= PROFIT_MARGIN_BENCHMARK.high)
      marginBand = "within";
    else marginBand = "above";
  }

  return {
    revenueBase,
    clientIncome: input.clientIncome,
    costUsed,
    remainingPlannedFunds,
    contingencyAmount,
    contingencyPercent,
    feeTargetProfit,
    realizedProfit,
    maxProjectedProfit,
    remainingPotential,
    realizedMarginPercent,
    projectedMarginPercent,
    marginBand,
  };
}

export const PROFIT_METHOD_NOTE = `Acuan margin = fee proyek ${PROJECT_FEE_PERCENT}% dari pendapatan. Keuntungan realisasi bisa bertambah jika pembayaran masuk dan biaya tetap terkendali. Estimasi bukan jaminan laba.`;

/** Kuota fee proyek: target − transfer fee − ambil pribadi owner */
export function calcFeeTransferQuota(input: {
  feeTargetProfit: number;
  feeTransferred: number;
  /** Ambil pribadi owner (bukan transfer fee) — mengurangi sisa fee */
  ownerPersonalDraws?: number;
}) {
  const feeTargetProfit = Math.max(0, input.feeTargetProfit);
  const feeTransferred = Math.max(0, input.feeTransferred);
  const ownerPersonalDraws = Math.max(0, input.ownerPersonalDraws ?? 0);
  const feeConsumed = feeTransferred + ownerPersonalDraws;
  const remaining = Math.max(0, feeTargetProfit - feeConsumed);
  return {
    feeTargetProfit,
    feeTransferred,
    ownerPersonalDraws,
    feeConsumed,
    remaining,
    exhausted: remaining <= 0,
  };
}
