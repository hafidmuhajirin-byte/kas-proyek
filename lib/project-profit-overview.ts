import { prisma } from "@/lib/prisma";
import { SCHOOL_RESIDUAL_CATEGORY } from "@/lib/project-completion";
import {
  fundKindFromCategoryName,
  projectFundKinds,
  type ProjectFundKind,
} from "@/lib/project-funds";
import {
  calcProjectProfit,
  PROJECT_FEE_PERCENT,
  type ProjectProfitResult,
} from "@/lib/project-profit";

export type ProjectProfitRow = {
  id: string;
  name: string;
  location: string;
  status: "ACTIVE" | "COMPLETED";
  profit: ProjectProfitResult;
};

export async function getProjectsProfitOverview(options?: {
  activeOnly?: boolean;
}) {
  const where =
    options?.activeOnly === false ? undefined : { status: "ACTIVE" as const };

  const [projects, txRows, advanceByProject] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        contractValue: true,
        billingMode: true,
        funds: { select: { kind: true, plannedAmount: true } },
        workItems: { select: { amount: true } },
        contractor: { select: { id: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        ...(where ? { project: where } : { projectId: { not: null } }),
      },
      select: {
        projectId: true,
        type: true,
        amount: true,
        isOwnerPersonal: true,
        isFeeTransfer: true,
        isMandorExpense: true,
        category: { select: { name: true } },
      },
    }),
    (async () => {
      const [contractors, groups] = await Promise.all([
        prisma.contractor.findMany({
          where: where ? { project: where } : undefined,
          select: { id: true, projectId: true },
        }),
        prisma.contractorAdvance.groupBy({
          by: ["contractorId"],
          _sum: { amount: true },
        }),
      ]);
      const sumByContractor = new Map(
        groups.map((g) => [g.contractorId, g._sum.amount ?? 0]),
      );
      const map = new Map<string, number>();
      for (const c of contractors) {
        map.set(
          c.projectId,
          (map.get(c.projectId) ?? 0) + (sumByContractor.get(c.id) ?? 0),
        );
      }
      return map;
    })(),
  ]);

  const txsByProject = new Map<string, typeof txRows>();
  for (const tx of txRows) {
    if (!tx.projectId) continue;
    const list = txsByProject.get(tx.projectId);
    if (list) list.push(tx);
    else txsByProject.set(tx.projectId, [tx]);
  }

  const rows: ProjectProfitRow[] = projects.map((project) => {
    const spentByKind: Partial<Record<ProjectFundKind, number>> = {};
    let clientIncome = 0;
    let operatingExpense = 0;

    for (const tx of txsByProject.get(project.id) ?? []) {
      if (tx.type === "INCOME" && !tx.isOwnerPersonal) {
        clientIncome += tx.amount;
      }
      if (
        tx.type === "EXPENSE" &&
        !tx.isOwnerPersonal &&
        !tx.isFeeTransfer &&
        !tx.isMandorExpense &&
        tx.category.name !== SCHOOL_RESIDUAL_CATEGORY
      ) {
        operatingExpense += tx.amount;
        const kind = fundKindFromCategoryName(tx.category.name);
        if (kind) {
          spentByKind[kind] = (spentByKind[kind] ?? 0) + tx.amount;
        }
      }
    }

    const contractorAdvances = 0; // Termin → Dana ke Mandor (sudah di operatingExpense)

    const remainingPlannedFunds = projectFundKinds.reduce((sum, kind) => {
      const planned =
        project.funds.find((f) => f.kind === kind)?.plannedAmount ?? 0;
      const spent = spentByKind[kind] ?? 0;
      return sum + Math.max(0, planned - spent);
    }, 0);

    const workCompletedValue = project.workItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    const profit = calcProjectProfit({
      contractValue: project.contractValue,
      billingMode: project.billingMode,
      workCompletedValue,
      clientIncome,
      operatingExpense,
      contractorAdvances,
      remainingPlannedFunds,
      contingencyPercent: 0,
    });

    return {
      id: project.id,
      name: project.name,
      location: project.location,
      status: project.status,
      profit,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.feeTargetProfit += row.profit.feeTargetProfit;
      acc.realizedProfit += row.profit.realizedProfit;
      acc.maxProjectedProfit += row.profit.maxProjectedProfit;
      acc.revenueBase += row.profit.revenueBase;
      acc.clientIncome += row.profit.clientIncome;
      return acc;
    },
    {
      feeTargetProfit: 0,
      realizedProfit: 0,
      maxProjectedProfit: 0,
      revenueBase: 0,
      clientIncome: 0,
      feePercent: PROJECT_FEE_PERCENT,
    },
  );

  return { rows, totals };
}
