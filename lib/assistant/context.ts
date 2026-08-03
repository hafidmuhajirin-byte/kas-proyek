import { getGlobalCashBreakdown, getProjectCashBalance } from "@/lib/balance";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  checklistProgressPercent,
  countCheckedChecklist,
  SCHOOL_RESIDUAL_CATEGORY,
  type ProjectChecklistState,
} from "@/lib/project-completion";
import {
  fundKindFromCategoryName,
  projectFundKinds,
  type ProjectFundKind,
} from "@/lib/project-funds";
import {
  calcFeeTransferQuota,
  calcProjectProfit,
  PROJECT_FEE_PERCENT,
} from "@/lib/project-profit";

export type AssistantReminder = {
  id: string;
  severity: "warn" | "info";
  text: string;
  href?: string;
};

export type AssistantProjectSnap = {
  id: string;
  name: string;
  location: string;
  status: "ACTIVE" | "COMPLETED";
  billingMode: string;
  balance: number;
  receivable: number;
  feeTarget: number;
  feeTransferred: number;
  feeRemaining: number;
  realizedProfit: number;
  maxProjectedProfit: number;
  checklistPercent: number;
  checklistDone: number;
  checklistTotal: number;
};

export type AssistantContext = {
  generatedAt: string;
  kasBesar: { total: number; cash: number; bank: number };
  feePercent: number;
  projects: AssistantProjectSnap[];
  recentTransactions: Array<{
    id: string;
    date: string;
    type: string;
    amount: number;
    description: string;
    projectName: string;
  }>;
  reminders: AssistantReminder[];
};

function checklistFrom(project: {
  checkPlanning: boolean;
  checkSupervision: boolean;
  checkManagement: boolean;
  checkTax: boolean;
  checkReporting: boolean;
  checkContractor: boolean;
  checkNoRetention: boolean;
}): ProjectChecklistState {
  return {
    checkPlanning: project.checkPlanning,
    checkSupervision: project.checkSupervision,
    checkManagement: project.checkManagement,
    checkTax: project.checkTax,
    checkReporting: project.checkReporting,
    checkContractor: project.checkContractor,
    checkNoRetention: project.checkNoRetention,
  };
}

export async function buildAssistantContext(): Promise<AssistantContext> {
  const [kasBesar, projects, recent] = await Promise.all([
    getGlobalCashBreakdown(),
    prisma.project.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        funds: true,
        workItems: { select: { amount: true } },
        transactions: {
          select: {
            type: true,
            amount: true,
            isOwnerPersonal: true,
            isFeeTransfer: true,
            isMandorExpense: true,
            category: { select: { name: true } },
          },
        },
        contractor: {
          include: { advances: { select: { amount: true } } },
        },
      },
    }),
    prisma.transaction.findMany({
      take: 8,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { project: { select: { name: true } } },
    }),
  ]);

  const snaps: AssistantProjectSnap[] = [];
  for (const project of projects) {
    const spentByKind: Partial<Record<ProjectFundKind, number>> = {};
    let clientIncome = 0;
    let operatingExpense = 0;
    let feeTransferred = 0;
    let ownerPersonalDraws = 0;

    for (const tx of project.transactions) {
      if (tx.type === "INCOME" && !tx.isOwnerPersonal) clientIncome += tx.amount;
      if (tx.type === "EXPENSE" && tx.isFeeTransfer) feeTransferred += tx.amount;
      if (
        tx.type === "EXPENSE" &&
        tx.isOwnerPersonal &&
        !tx.isFeeTransfer
      ) {
        ownerPersonalDraws += tx.amount;
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
        if (kind) spentByKind[kind] = (spentByKind[kind] ?? 0) + tx.amount;
      }
    }

    const contractorAdvances = project.contractor
      ? project.contractor.advances.reduce((s, a) => s + a.amount, 0)
      : 0;
    const remainingPlannedFunds = projectFundKinds.reduce((sum, kind) => {
      const planned =
        project.funds.find((f) => f.kind === kind)?.plannedAmount ?? 0;
      return sum + Math.max(0, planned - (spentByKind[kind] ?? 0));
    }, 0);
    const workCompletedValue = project.workItems.reduce(
      (s, i) => s + i.amount,
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
    const feeQuota = calcFeeTransferQuota({
      feeTargetProfit: profit.feeTargetProfit,
      feeTransferred,
      ownerPersonalDraws,
    });
    const checks = checklistFrom(project);
    const balance = await getProjectCashBalance(project.id);
    const receivable = Math.max(0, workCompletedValue - clientIncome);

    snaps.push({
      id: project.id,
      name: project.name,
      location: project.location,
      status: project.status,
      billingMode: project.billingMode,
      balance,
      receivable:
        project.billingMode === "PAY_AT_END" ? receivable : 0,
      feeTarget: feeQuota.feeTargetProfit,
      feeTransferred: feeQuota.feeTransferred,
      feeRemaining: feeQuota.remaining,
      realizedProfit: profit.realizedProfit,
      maxProjectedProfit: profit.maxProjectedProfit,
      checklistPercent: checklistProgressPercent(checks),
      checklistDone: countCheckedChecklist(checks),
      checklistTotal: 6,
    });
  }

  const reminders: AssistantReminder[] = [];
  if (kasBesar.total <= 0) {
    reminders.push({
      id: "kas-habis",
      severity: "warn",
      text: `Kas besar ${kasBesar.total < 0 ? "minus" : "habis"} (${formatRupiah(kasBesar.total)}). Setor dana pribadi sebelum pengeluaran baru.`,
      href: "/transactions/new?type=INCOME",
    });
  }

  for (const p of snaps.filter((x) => x.status === "ACTIVE")) {
    if (p.balance < 0) {
      reminders.push({
        id: `kas-neg-${p.id}`,
        severity: "warn",
        text: `${p.name}: kas proyek minus ${formatRupiah(p.balance)}.`,
        href: `/projects/${p.id}`,
      });
    } else if (p.balance > 0 && p.balance < 1_000_000) {
      reminders.push({
        id: `kas-low-${p.id}`,
        severity: "info",
        text: `${p.name}: kas proyek rendah (${formatRupiah(p.balance)}).`,
        href: `/projects/${p.id}`,
      });
    }
    if (p.feeTarget > 0 && p.feeTransferred === 0) {
      reminders.push({
        id: `fee-none-${p.id}`,
        severity: "info",
        text: `${p.name}: target fee ${formatRupiah(p.feeTarget)} belum ada yang ditransfer ke bank pribadi.`,
        href: `/projects/${p.id}`,
      });
    }
    if (p.feeTarget > 0 && p.feeRemaining <= p.feeTarget * 0.1 && p.feeRemaining > 0) {
      reminders.push({
        id: `fee-almost-${p.id}`,
        severity: "info",
        text: `${p.name}: sisa kuota fee tinggal ${formatRupiah(p.feeRemaining)}.`,
        href: `/projects/${p.id}`,
      });
    }
    if (p.checklistPercent < 100) {
      reminders.push({
        id: `check-${p.id}`,
        severity: "info",
        text: `${p.name}: checklist penyelesaian ${p.checklistDone}/${p.checklistTotal} (${p.checklistPercent}%).`,
        href: `/projects/${p.id}`,
      });
    }
    if (p.receivable > 0) {
      reminders.push({
        id: `piutang-${p.id}`,
        severity: "warn",
        text: `${p.name}: piutang ${formatRupiah(p.receivable)}.`,
        href: `/projects/${p.id}`,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    kasBesar,
    feePercent: PROJECT_FEE_PERCENT,
    projects: snaps,
    recentTransactions: recent.map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString(),
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      projectName: tx.project?.name ?? "Dana pribadi owner",
    })),
    reminders,
  };
}
