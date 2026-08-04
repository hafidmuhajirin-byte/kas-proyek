/**
 * Estimasi keuntungan proyek.
 * Rumus: (nilai kontrak − dana operasional) × 5%.
 */

import { projectFundKinds } from "@/lib/project-funds";

/** Persentase estimasi keuntungan dari (kontrak − dana operasional) */
export const PROJECT_FEE_PERCENT = 5;

/** Pita banding di sekitar estimasi (untuk indikator warna) */
export const PROFIT_MARGIN_BENCHMARK = {
  low: 4,
  high: 6,
  target: PROJECT_FEE_PERCENT,
} as const;

export type ProjectProfitInput = {
  contractValue: number;
  billingMode: "ON_REQUEST" | "TERMIN_PLAN" | "PAY_AT_END";
  workCompletedValue: number;
  clientIncome: number;
  /** Biaya operasional terpakai (tanpa ambil owner / sisa sekolah / bukti Mandor) */
  operatingExpense: number;
  /** Termin/pembayaran ke pemborong (biaya kas nyata; bukti Mandor tidak dijumlah lagi) */
  contractorAdvances: number;
  /** Total rencana dana operasional (semua pos) */
  operationalFunds: number;
  /** Sisa rencana 5 pos dana: sum(max(0, planned − spent)) */
  remainingPlannedFunds: number;
  /** 0–15 (persen) kontinjensi risiko atas biaya */
  contingencyPercent: number;
};

export type ProjectProfitResult = {
  revenueBase: number;
  clientIncome: number;
  costUsed: number;
  operationalFunds: number;
  /** max(0, kontrak − dana operasional) */
  feeBase: number;
  remainingPlannedFunds: number;
  contingencyAmount: number;
  contingencyPercent: number;
  /** Estimasi = (kontrak − dana operasional) × 5% */
  feeTargetProfit: number;
  realizedProfit: number;
  maxProjectedProfit: number;
  remainingPotential: number;
  realizedMarginPercent: number | null;
  projectedMarginPercent: number | null;
  marginBand: "below" | "within" | "above" | "n/a";
};

/** Jumlah rencana dana operasional dari baris ProjectFund. */
export function calcOperationalFunds(
  funds: { kind: string; plannedAmount: number }[],
) {
  return projectFundKinds.reduce((sum, kind) => {
    const row = funds.find((f) => f.kind === kind);
    return sum + Math.max(0, row?.plannedAmount ?? 0);
  }, 0);
}

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
  const contractValue = Math.max(0, input.contractValue);
  const operationalFunds = Math.max(0, input.operationalFunds);
  const feeBase = Math.max(0, contractValue - operationalFunds);

  // Biaya nyata: operasional + termin pemborong. Bukti Mandor = laporan pemakaian dana cair, bukan biaya baru.
  const costUsed = input.operatingExpense + input.contractorAdvances;
  const remainingPlannedFunds = Math.max(0, input.remainingPlannedFunds);
  const contingencyBase = costUsed + remainingPlannedFunds;
  const contingencyAmount = Math.round(
    (contingencyBase * contingencyPercent) / 100,
  );

  const feeTargetProfit = Math.round(
    (feeBase * PROJECT_FEE_PERCENT) / 100,
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
    operationalFunds,
    feeBase,
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

export const PROFIT_METHOD_NOTE = `Estimasi keuntungan = (nilai kontrak − dana operasional) × ${PROJECT_FEE_PERCENT}%. Realisasi = pembayaran klien − (biaya operasional + dana ke mandor). Bukti Mandor tidak dihitung biaya kedua. Estimasi bukan jaminan laba.`;

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
