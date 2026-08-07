import type { BkkReportRow } from "@/lib/project-bkk-report";

type ExpenseLine = {
  id: string;
  kind: "MATERIAL" | "LABOR";
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  workDays: number | null;
  dailyRate: number | null;
  amount: number;
};

type TxInput = {
  id: string;
  date: Date;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  isOwnerPersonal: boolean;
  isFeeTransfer: boolean;
  isFromGlobalCash: boolean;
  isMandorExpense: boolean;
  isMandorDisbursement: boolean;
  categoryName: string;
  expenseLines: ExpenseLine[];
};

type AdvanceInput = {
  id: string;
  date: Date;
  amount: number;
  description: string;
  contractorName: string;
};

/** Susun baris BKK untuk satu proyek. */
export function buildProjectBkkRows(
  transactions: TxInput[],
  advances: AdvanceInput[],
): BkkReportRow[] {
  const rows: BkkReportRow[] = [];
  let bkm = 0;
  let bkk = 0;
  let trm = 0;
  let bkl = 0;

  const events: Array<
    | { sort: number; key: string; kind: "tx"; tx: TxInput }
    | { sort: number; key: string; kind: "adv"; adv: AdvanceInput }
  > = [
    ...transactions.map((tx) => ({
      sort: tx.date.getTime(),
      key: `tx-${tx.id}`,
      kind: "tx" as const,
      tx,
    })),
    ...advances.map((adv) => ({
      sort: adv.date.getTime(),
      key: `adv-${adv.id}`,
      kind: "adv" as const,
      adv,
    })),
  ].sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));

  for (const ev of events) {
    if (ev.kind === "adv") {
      trm += 1;
      rows.push({
        id: `adv-${ev.adv.id}`,
        date: ev.adv.date,
        buktiNo: `TRM.${trm}`,
        status: "Termin",
        quantity: null,
        unit: null,
        keterangan: `${ev.adv.contractorName} — ${ev.adv.description}`,
        unitPrice: null,
        penerimaan: 0,
        pengeluaran: ev.adv.amount,
      });
      continue;
    }

    const tx = ev.tx;

    if (tx.type === "INCOME") {
      bkm += 1;
      rows.push({
        id: `tx-${tx.id}`,
        date: tx.date,
        buktiNo: `BKM.${bkm}`,
        status: tx.isOwnerPersonal ? "Setor" : "Terima",
        quantity: null,
        unit: null,
        keterangan: tx.description,
        unitPrice: null,
        penerimaan: tx.amount,
        pengeluaran: 0,
      });
      continue;
    }

    // EXPENSE
    if (tx.isMandorExpense) {
      bkk += 1;
      const buktiNo = `BKK.${bkk}`;
      if (tx.expenseLines.length > 0) {
        for (const line of tx.expenseLines) {
          const qty = line.quantity ?? line.workDays;
          const price = line.unitPrice ?? line.dailyRate;
          rows.push({
            id: `line-${line.id}`,
            date: tx.date,
            buktiNo,
            status: line.kind === "LABOR" ? "Bayar" : "Beli",
            quantity: qty,
            unit: line.unit ?? (line.kind === "LABOR" ? "hari" : null),
            keterangan: line.description,
            unitPrice: price,
            penerimaan: 0,
            pengeluaran: line.amount,
            skipBalance: true,
          });
        }
      } else {
        rows.push({
          id: `tx-${tx.id}`,
          date: tx.date,
          buktiNo,
          status: "Beli",
          quantity: null,
          unit: null,
          keterangan: tx.description,
          unitPrice: null,
          penerimaan: 0,
          pengeluaran: tx.amount,
          skipBalance: true,
        });
      }
      continue;
    }

    bkl += 1;
    const skip =
      tx.isFromGlobalCash ||
      (tx.isOwnerPersonal && !tx.isFeeTransfer);
    rows.push({
      id: `tx-${tx.id}`,
      date: tx.date,
      buktiNo: tx.isMandorDisbursement ? `DMR.${bkl}` : `BK.${bkl}`,
      status: tx.isFeeTransfer
        ? "Fee"
        : tx.isMandorDisbursement
          ? "Cair"
          : tx.isOwnerPersonal
            ? "Ambil"
            : "Keluar",
      quantity: null,
      unit: null,
      keterangan: `${tx.categoryName} — ${tx.description}`,
      unitPrice: null,
      penerimaan: 0,
      pengeluaran: tx.amount,
      skipBalance: skip || undefined,
    });
  }

  return rows;
}
