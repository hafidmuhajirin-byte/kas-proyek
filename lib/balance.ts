import { prisma } from "@/lib/prisma";
import { signedAmount } from "@/lib/money";
import { isOwnerPersonalDraw } from "@/lib/owner-personal";

export type FundingProgress = {
  stageId: string;
  name: string;
  sequence: number;
  percent: number;
  plannedAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  status: "BELUM" | "SEBAGIAN" | "LUNAS" | "LEBIH";
};

export function calcStageStatus(
  received: number,
  planned: number,
): FundingProgress["status"] {
  if (received <= 0) return "BELUM";
  if (received < planned) return "SEBAGIAN";
  if (received === planned) return "LUNAS";
  return "LEBIH";
}

/** Termin digabung ke Dana ke Mandor — tidak ada lagi potongan advance terpisah. */
async function getProjectAdvanceTotals() {
  return new Map<string, number>();
}

export async function getProjectCashBalance(
  projectId: string,
  options?: { excludeAdvanceId?: string; excludeTransactionId?: string },
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      transactions: {
        where: options?.excludeTransactionId
          ? { NOT: { id: options.excludeTransactionId } }
          : undefined,
        select: {
          type: true,
          amount: true,
          isOwnerPersonal: true,
          isFeeTransfer: true,
          isMandorExpense: true,
        },
      },
      // Termin digabung ke Dana ke Mandor (Transaction isMandorDisbursement)
    },
  });
  if (!project) return 0;

  const movement = project.transactions.reduce((sum, tx) => {
    // Ambil pribadi owner dari kas besar — tidak mengubah kas proyek
    if (isOwnerPersonalDraw(tx)) return sum;
    // Bukti belanja Mandor hanya laporan (dana sudah keluar saat pencairan)
    if (tx.isMandorExpense) return sum;
    return sum + signedAmount(tx.type, tx.amount);
  }, 0);
  return project.openingBalance + movement;
}

export async function getProjectBalances() {
  const [projects, advanceByProject, txGroups, stageIncomeGroups] =
    await Promise.all([
      prisma.project.findMany({
        orderBy: [{ status: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
          billingMode: true,
          openingBalance: true,
          contractValue: true,
          fundingStages: {
            orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              name: true,
              sequence: true,
              percent: true,
              plannedAmount: true,
            },
          },
          workItems: {
            select: { amount: true },
          },
        },
      }),
      getProjectAdvanceTotals(),
      prisma.transaction.groupBy({
        by: [
          "projectId",
          "type",
          "isOwnerPersonal",
          "isFeeTransfer",
          "isMandorExpense",
        ],
        where: { projectId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ["fundingStageId"],
        where: { type: "INCOME", fundingStageId: { not: null } },
        _sum: { amount: true },
      }),
    ]);

  type TxAgg = {
    income: number;
    ownerPersonalInjection: number;
    expense: number;
    ownerPersonalExpense: number;
    projectExpense: number;
    movement: number;
  };
  const txByProject = new Map<string, TxAgg>();

  for (const g of txGroups) {
    if (!g.projectId) continue;
    const amount = g._sum.amount ?? 0;
    const agg = txByProject.get(g.projectId) ?? {
      income: 0,
      ownerPersonalInjection: 0,
      expense: 0,
      ownerPersonalExpense: 0,
      projectExpense: 0,
      movement: 0,
    };
    const tx = {
      type: g.type,
      isOwnerPersonal: g.isOwnerPersonal,
      isFeeTransfer: g.isFeeTransfer,
      isMandorExpense: g.isMandorExpense,
    };
    if (g.type === "INCOME" && !g.isOwnerPersonal) agg.income += amount;
    if (g.type === "INCOME" && g.isOwnerPersonal) {
      agg.ownerPersonalInjection += amount;
    }
    if (g.type === "EXPENSE" && !isOwnerPersonalDraw(tx)) {
      agg.expense += amount;
    }
    if (isOwnerPersonalDraw(tx)) agg.ownerPersonalExpense += amount;
    if (g.type === "EXPENSE" && !g.isOwnerPersonal && !g.isFeeTransfer && !g.isMandorExpense) {
      agg.projectExpense += amount;
    }
    if (!isOwnerPersonalDraw(tx) && !g.isMandorExpense) {
      agg.movement += signedAmount(g.type, amount);
    }
    txByProject.set(g.projectId, agg);
  }

  const stageReceived = new Map(
    stageIncomeGroups
      .filter((g) => g.fundingStageId)
      .map((g) => [g.fundingStageId!, g._sum.amount ?? 0]),
  );

  return projects.map((project) => {
    const agg = txByProject.get(project.id) ?? {
      income: 0,
      ownerPersonalInjection: 0,
      expense: 0,
      ownerPersonalExpense: 0,
      projectExpense: 0,
      movement: 0,
    };
    const contractorAdvances = advanceByProject.get(project.id) ?? 0;
    const balance = project.openingBalance + agg.movement - contractorAdvances;

    const stages: FundingProgress[] = project.fundingStages.map((stage) => {
      const receivedAmount = stageReceived.get(stage.id) ?? 0;
      const plannedAmount = stage.plannedAmount;
      const progressPercent =
        plannedAmount > 0
          ? Math.min(100, Math.round((receivedAmount / plannedAmount) * 100))
          : 0;
      return {
        stageId: stage.id,
        name: stage.name,
        sequence: stage.sequence,
        percent: stage.percent,
        plannedAmount,
        receivedAmount,
        remainingAmount: Math.max(0, plannedAmount - receivedAmount),
        progressPercent,
        status: calcStageStatus(receivedAmount, plannedAmount),
      };
    });

    const plannedFunding = stages.reduce((sum, s) => sum + s.plannedAmount, 0);
    const receivedFunding = stages.reduce((sum, s) => sum + s.receivedAmount, 0);
    const fundingBase =
      project.contractValue > 0 ? project.contractValue : plannedFunding;
    const fundingProgressPercent =
      fundingBase > 0
        ? Math.min(100, Math.round((receivedFunding / fundingBase) * 100))
        : 0;

    const workCompletedValue = project.workItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const receivable = Math.max(0, workCompletedValue - agg.income);
    const workPaidPercent =
      workCompletedValue > 0
        ? Math.min(100, Math.round((agg.income / workCompletedValue) * 100))
        : 0;

    return {
      id: project.id,
      name: project.name,
      location: project.location,
      status: project.status,
      billingMode: project.billingMode,
      openingBalance: project.openingBalance,
      contractValue: project.contractValue,
      income: agg.income,
      expense: agg.expense,
      ownerPersonalExpense: agg.ownerPersonalExpense,
      ownerPersonalInjection: agg.ownerPersonalInjection,
      projectExpense: agg.projectExpense,
      contractorAdvances,
      balance,
      stages,
      plannedFunding,
      receivedFunding,
      fundingProgressPercent,
      workCompletedValue,
      receivable,
      workPaidPercent,
    };
  });
}

export async function getGlobalCashBreakdown(
  options?: {
    excludeTransactionId?: string;
    excludeAdvanceId?: string;
    excludeTransferId?: string;
  },
) {
  const [opening, sources, txGroups, advanceGroups, transfers] =
    await Promise.all([
      prisma.project.aggregate({
        _sum: { openingBalance: true },
      }),
      prisma.cashSource.findMany({
        select: { id: true, type: true },
      }),
      prisma.transaction.groupBy({
        by: ["type", "isFromGlobalCash", "isMandorExpense", "cashSourceId"],
        where: options?.excludeTransactionId
          ? { NOT: { id: options.excludeTransactionId } }
          : undefined,
        _sum: { amount: true },
      }),
      prisma.contractorAdvance.groupBy({
        by: ["cashSourceId"],
        where: options?.excludeAdvanceId
          ? { NOT: { id: options.excludeAdvanceId } }
          : undefined,
        _sum: { amount: true },
      }),
      prisma.cashTransfer.findMany({
        where: options?.excludeTransferId
          ? { NOT: { id: options.excludeTransferId } }
          : undefined,
        select: {
          amount: true,
          fromCashSource: { select: { type: true } },
          toCashSource: { select: { type: true } },
        },
      }),
    ]);

  const sourceType = new Map(sources.map((s) => [s.id, s.type]));

  // Saldo awal proyek belum punya sumber → dihitung ke Tunai
  let cash = opening._sum.openingBalance ?? 0;
  let bank = 0;

  for (const g of txGroups) {
    // Pengeluaran "masuk kas besar": kas proyek turun, kas besar tetap
    if (g.type === "EXPENSE" && g.isFromGlobalCash) continue;
    // Bukti Mandor tidak potong kas lagi
    if (g.isMandorExpense) continue;
    const amount = g._sum.amount ?? 0;
    const signed = signedAmount(g.type, amount);
    const channel = sourceType.get(g.cashSourceId);
    if (channel && isBankChannel(channel)) bank += signed;
    else cash += signed;
  }

  // Termin digabung ke Dana ke Mandor (sudah masuk Transaction)

  // Transfer antar saluran: total tetap, Tunai/Bank berpindah
  for (const transfer of transfers) {
    if (isBankChannel(transfer.fromCashSource.type)) bank -= transfer.amount;
    else cash -= transfer.amount;
    if (isBankChannel(transfer.toCashSource.type)) bank += transfer.amount;
    else cash += transfer.amount;
  }

  return {
    cash,
    bank,
    total: cash + bank,
  };
}

export function isBankChannel(type: string) {
  return type === "BANK" || type === "CLIENT_TRANSFER";
}

export async function getGlobalCashBalance(
  options?: {
    excludeTransactionId?: string;
    excludeAdvanceId?: string;
    excludeTransferId?: string;
  },
) {
  const breakdown = await getGlobalCashBreakdown(options);
  return breakdown.total;
}

export async function getChannelCashBalance(
  cashSourceId: string,
  options?: {
    excludeTransactionId?: string;
    excludeAdvanceId?: string;
    excludeTransferId?: string;
  },
) {
  const source = await prisma.cashSource.findUnique({
    where: { id: cashSourceId },
    select: { type: true },
  });
  if (!source) return 0;
  const breakdown = await getGlobalCashBreakdown(options);
  return isBankChannel(source.type) ? breakdown.bank : breakdown.cash;
}

export async function getPeriodSummary(from?: Date, to?: Date) {
  const dateFilter =
    from || to
      ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {};

  const [txGroups, advanceSum] = await Promise.all([
    prisma.transaction.groupBy({
      by: [
        "type",
        "isOwnerPersonal",
        "isFeeTransfer",
        "isFromGlobalCash",
        "isMandorExpense",
      ],
      where: dateFilter,
      _sum: { amount: true },
    }),
    prisma.contractorAdvance.aggregate({
      where: dateFilter,
      _sum: { amount: true },
    }),
  ]);

  let income = 0;
  let ownerPersonalInjection = 0;
  let expense = 0;
  let ownerPersonalExpense = 0;
  let feeTransferExpense = 0;
  let cashAffectingExpense = 0;
  let mandorExpense = 0;

  for (const g of txGroups) {
    const amount = g._sum.amount ?? 0;
    const tx = {
      type: g.type,
      isOwnerPersonal: g.isOwnerPersonal,
      isFeeTransfer: g.isFeeTransfer,
    };
    if (g.type === "INCOME" && !g.isOwnerPersonal) income += amount;
    if (g.type === "INCOME" && g.isOwnerPersonal) {
      ownerPersonalInjection += amount;
    }
    if (g.type === "EXPENSE") expense += amount;
    if (isOwnerPersonalDraw(tx)) ownerPersonalExpense += amount;
    if (g.type === "EXPENSE" && g.isFeeTransfer) feeTransferExpense += amount;
    if (g.type === "EXPENSE" && g.isMandorExpense) mandorExpense += amount;
    if (
      g.type === "EXPENSE" &&
      !g.isFromGlobalCash &&
      !g.isMandorExpense
    ) {
      cashAffectingExpense += amount;
    }
  }

  // Termin digabung ke Dana ke Mandor — biaya masuk via isMandorDisbursement
  const contractorAdvances = 0;

  return {
    income,
    expense,
    ownerPersonalExpense,
    ownerPersonalInjection,
    contractorAdvances,
    projectExpense:
      expense - ownerPersonalExpense - feeTransferExpense - mandorExpense,
    net:
      income +
      ownerPersonalInjection -
      cashAffectingExpense,
  };
}
