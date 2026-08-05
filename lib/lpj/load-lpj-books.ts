import {
  buildBankMonthBlocks,
  buildBankMutationsFromProject,
  type BankMonthBlock,
} from "@/lib/buku-kas/bank";
import {
  buildCashBookRows,
  type CashBookLine,
} from "@/lib/project-cash-book";
import {
  computeLineTax,
  getTaxCeilingStatus,
  type TaxCeilingStatus,
  type TaxLineResult,
} from "@/lib/lpj/tax-compliance";
import { prisma } from "@/lib/prisma";

export type LpjTaxRow = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  isMaterialAlam: boolean;
  tax: TaxLineResult;
};

export type LpjBooksPayload = {
  project: {
    id: string;
    name: string;
    location: string;
    contractValue: number;
    openingBalance: number;
    lpjKepalaNama: string | null;
    lpjKepalaNip: string | null;
    lpjKetuaNama: string | null;
    lpjKetuaNip: string | null;
    lpjBendaharaNama: string | null;
    lpjBendaharaNip: string | null;
    lpjKabKota: string | null;
    lpjProvinsi: string | null;
  };
  bankBlocks: BankMonthBlock[];
  bkuRows: CashBookLine[];
  bktRows: CashBookLine[];
  taxRows: LpjTaxRow[];
  taxTotals: {
    totalTax: number;
    totalPpn: number;
    totalPph: number;
  };
  taxCeiling: TaxCeilingStatus;
  trancheSummary: {
    phase70Received: number;
    phase30Received: number;
    totalPengambilan: number;
  };
};

/** Muat data pratinjau semua buku LPJ untuk satu proyek. */
export async function loadLpjBooks(
  projectId: string,
): Promise<LpjBooksPayload | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      location: true,
      contractValue: true,
      openingBalance: true,
      status: true,
      lpjKepalaNama: true,
      lpjKepalaNip: true,
      lpjKetuaNama: true,
      lpjKetuaNip: true,
      lpjBendaharaNama: true,
      lpjBendaharaNip: true,
      lpjKabKota: true,
      lpjProvinsi: true,
      bankTranches: true,
      transactions: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          date: true,
          type: true,
          amount: true,
          description: true,
          isMandorExpense: true,
          isOwnerPersonal: true,
          isFeeTransfer: true,
          isMandorDisbursement: true,
          isMaterialAlam: true,
          category: { select: { name: true } },
          cashSource: { select: { name: true, type: true } },
        },
      },
    },
  });
  if (!project || project.status !== "ACTIVE") return null;

  const t70 = project.bankTranches.find((t) => t.phase === "PHASE_70");
  const t30 = project.bankTranches.find((t) => t.phase === "PHASE_30");

  // Pengambilan = dana yang diterima Owner dari User (INCOME proyek, bukan pribadi/fee)
  const ownerReceipts = project.transactions
    .filter(
      (tx) =>
        tx.type === "INCOME" &&
        !tx.isOwnerPersonal &&
        !tx.isFeeTransfer,
    )
    .map((tx) => ({
      date: tx.date,
      amount: tx.amount,
      description: tx.description,
    }));

  const { mutations, totalPengambilan } = buildBankMutationsFromProject({
    tranches: project.bankTranches.map((t) => ({
      phase: t.phase,
      receivedAmount: t.receivedAmount,
      receivedAt: t.receivedAt,
    })),
    ownerReceipts,
  });
  const bankBlocks = buildBankMonthBlocks(mutations);

  const ledgerTx = project.transactions.filter(
    (tx) => !tx.isOwnerPersonal && !tx.isFeeTransfer,
  );

  const bkuRows = buildCashBookRows(
    ledgerTx.map((tx) => ({
      date: tx.date,
      description: tx.description,
      type: tx.type,
      amount: tx.amount,
      isMandorExpense: tx.isMandorExpense,
      categoryName: tx.category.name,
      cashSourceName: tx.cashSource.name,
    })),
    project.openingBalance,
  );

  const cashTx = ledgerTx.filter((tx) => tx.cashSource.type === "CASH");
  const bktRows = buildCashBookRows(
    cashTx.map((tx) => ({
      date: tx.date,
      description: tx.description,
      type: tx.type,
      amount: tx.amount,
      isMandorExpense: tx.isMandorExpense,
      categoryName: tx.category.name,
      cashSourceName: tx.cashSource.name,
    })),
    project.openingBalance,
  );

  const expenseForTax = ledgerTx.filter(
    (tx) =>
      tx.type === "EXPENSE" &&
      !tx.isMandorDisbursement &&
      !tx.isFeeTransfer,
  );
  const taxRows: LpjTaxRow[] = expenseForTax.map((tx) => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    isMaterialAlam: tx.isMaterialAlam,
    tax: computeLineTax({
      amount: tx.amount,
      description: tx.description,
      isMaterialAlam: tx.isMaterialAlam,
    }),
  }));

  let totalTax = 0;
  let totalPpn = 0;
  let totalPph = 0;
  for (const row of taxRows) {
    totalTax += row.tax.totalTax;
    totalPpn += row.tax.ppn;
    totalPph += row.tax.pph;
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      location: project.location,
      contractValue: project.contractValue,
      openingBalance: project.openingBalance,
      lpjKepalaNama: project.lpjKepalaNama,
      lpjKepalaNip: project.lpjKepalaNip,
      lpjKetuaNama: project.lpjKetuaNama,
      lpjKetuaNip: project.lpjKetuaNip,
      lpjBendaharaNama: project.lpjBendaharaNama,
      lpjBendaharaNip: project.lpjBendaharaNip,
      lpjKabKota: project.lpjKabKota,
      lpjProvinsi: project.lpjProvinsi,
    },
    bankBlocks,
    bkuRows,
    bktRows,
    taxRows,
    taxTotals: { totalTax, totalPpn, totalPph },
    taxCeiling: getTaxCeilingStatus(totalTax, project.contractValue),
    trancheSummary: {
      phase70Received: t70?.receivedAmount ?? 0,
      phase30Received: t30?.receivedAmount ?? 0,
      totalPengambilan,
    },
  };
}
