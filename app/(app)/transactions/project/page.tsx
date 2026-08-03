import Link from "next/link";
import { deleteContractorAdvanceAction } from "@/lib/actions/contractor";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import {
  canBreakDownMandorExpense,
  isOwner,
  isAdmin,
  requireSession,
} from "@/lib/auth";
import {
  buildRunningBalance,
  sumCashMovements,
  type LedgerLine,
} from "@/lib/report-ledger";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import {
  BookLedgerTable,
  BookSummaryStrip,
  type BookRow,
} from "@/components/BookLedgerTable";
import {
  MandorExpenseBreakdownForm,
  type ExpenseLineRow,
} from "@/components/MandorExpenseBreakdownForm";
import {
  btnSecondaryClass,
  Card,
  PageHeader,
} from "@/components/ui";

/**
 * Kas Proyek — buku kas per proyek.
 * Bukti Mandor = laporan (*) tanpa memotong saldo.
 */
export default async function KasProyekPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    projectId?: string;
    type?: string;
  }>;
}) {
  const user = await requireSession();
  const owner = isOwner(user);
  const readOnlyAdmin = isAdmin(user);
  const canMutate = owner;
  const canBreakDown = canBreakDownMandorExpense(user);
  const params = await searchParams;
  const hasTypeFilter =
    params.type === "INCOME" || params.type === "EXPENSE";
  const includeAdvances = params.type !== "INCOME";
  const needsProject = !params.projectId;

  const where = {
    ...(needsProject ? { id: "__none__" } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(hasTypeFilter ? { type: params.type as "INCOME" | "EXPENSE" } : {}),
    ...(readOnlyAdmin ? { isOwnerPersonal: false } : {}),
    ...(params.q
      ? {
          OR: [
            { description: { contains: params.q } },
            { project: { name: { contains: params.q } } },
            { project: { location: { contains: params.q } } },
            { cashSource: { name: { contains: params.q } } },
            { category: { name: { contains: params.q } } },
          ],
        }
      : {}),
  };

  const advanceWhere = {
    ...(needsProject ? { id: "__none__" } : {}),
    ...(params.projectId
      ? { contractor: { projectId: params.projectId } }
      : {}),
    ...(params.q
      ? {
          OR: [
            { description: { contains: params.q } },
            { cashSource: { name: { contains: params.q } } },
            { contractor: { name: { contains: params.q } } },
            { contractor: { project: { name: { contains: params.q } } } },
          ],
        }
      : {}),
  };

  const [transactions, advances, projects] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        type: true,
        amount: true,
        description: true,
        proofUrl: true,
        isOwnerPersonal: true,
        isFeeTransfer: true,
        isFromGlobalCash: true,
        isMandorDisbursement: true,
        isMandorExpense: true,
        breakdownVendor: true,
        breakdownStatus: true,
        breakdownNote: true,
        projectId: true,
        project: { select: { id: true, name: true, location: true } },
        cashSource: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, name: true } },
        fundingStage: { select: { id: true, name: true } },
        linkedMandorDisbursement: {
          select: { label: true, amount: true },
        },
        linkedContractorAdvance: {
          select: {
            description: true,
            amount: true,
            contractor: { select: { name: true } },
          },
        },
        expenseLines: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            kind: true,
            description: true,
            quantity: true,
            unit: true,
            unitPrice: true,
            workDays: true,
            dailyRate: true,
            amount: true,
          },
        },
      },
    }),
    includeAdvances
      ? prisma.contractorAdvance.findMany({
          where: advanceWhere,
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            date: true,
            amount: true,
            description: true,
            proofUrl: true,
            cashSource: { select: { id: true, name: true, type: true } },
            contractor: {
              select: {
                id: true,
                name: true,
                projectId: true,
                project: {
                  select: { id: true, name: true, location: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        openingBalance: true,
      },
    }),
  ]);

  const projectsInScope = params.projectId
    ? projects.filter((p) => p.id === params.projectId)
    : [];

  const opening =
    params.projectId && !params.q && !hasTypeFilter
      ? projectsInScope.reduce((sum, p) => sum + p.openingBalance, 0)
      : 0;

  const ledgerLines: LedgerLine[] = [
    ...transactions.map((tx) => {
      let pencairanNote = "";
      if (tx.isMandorExpense) {
        if (tx.linkedMandorDisbursement) {
          pencairanNote = ` · acuan ${tidyCase(tx.linkedMandorDisbursement.label)}`;
        } else if (tx.linkedContractorAdvance) {
          pencairanNote = ` · acuan termin ${tidyCase(tx.linkedContractorAdvance.contractor.name)}`;
        }
      }
      return {
        id: `tx-${tx.id}`,
        date: tx.date,
        projectId: tx.projectId ?? "",
        projectName: tx.project
          ? tidyCase(tx.project.name)
          : "Dana pribadi owner",
        location: tx.project ? tidyCase(tx.project.location) : "—",
        sourceName: tidyCase(tx.cashSource.name),
        kind:
          tx.type === "INCOME"
            ? tx.isOwnerPersonal
              ? "Setoran pribadi"
              : "Pemasukan"
            : tx.isFeeTransfer
              ? "Transfer fee"
              : tx.isMandorExpense
                ? "Belanja Mandor"
                : tx.isMandorDisbursement
                  ? "Pembayaran ke Mandor"
                  : tx.isOwnerPersonal
                    ? "Ambil pribadi"
                    : tx.isFromGlobalCash
                      ? "Masuk kas besar"
                      : "Pengeluaran",
        description: tx.fundingStage
          ? `${tidyCase(tx.category.name)} — ${tidyCase(tx.description)} · ${tidyCase(tx.fundingStage.name)}${pencairanNote}`
          : `${tidyCase(tx.category.name)} — ${tidyCase(tx.description)}${pencairanNote}`,
        debit: tx.type === "INCOME" ? tx.amount : 0,
        credit: tx.type === "EXPENSE" ? tx.amount : 0,
        skipBalance:
          (tx.type === "EXPENSE" && tx.isFromGlobalCash) ||
          Boolean(tx.isMandorExpense),
      };
    }),
    ...advances.map((a) => ({
      id: `adv-${a.id}`,
      date: a.date,
      projectId: a.contractor.projectId,
      projectName: tidyCase(a.contractor.project.name),
      location: tidyCase(a.contractor.project.location),
      sourceName: tidyCase(a.cashSource.name),
      kind: "Pembayaran ke Pemborong",
      description: `${tidyCase(a.contractor.name)} — ${tidyCase(a.description)}`,
      debit: 0,
      credit: a.amount,
    })),
  ];

  const bookChrono = buildRunningBalance(ledgerLines, opening, {
    honorSkipBalance: true,
  });

  const cashMoves = sumCashMovements(bookChrono);
  const totalIn = cashMoves.debit + (opening > 0 ? opening : 0);
  const totalOut = cashMoves.credit;
  const saldoAkhir =
    bookChrono.length > 0
      ? bookChrono[bookChrono.length - 1].balance
      : opening;

  const expenseLinesByTx = new Map<string, ExpenseLineRow[]>();
  const breakdownMetaByTx = new Map<
    string,
    {
      vendor: string | null;
      status: "PENDING" | "APPROVED" | "REJECTED";
      note: string | null;
    }
  >();
  for (const tx of transactions) {
    if (tx.isMandorExpense) {
      expenseLinesByTx.set(
        tx.id,
        tx.expenseLines.map((l) => ({
          id: l.id,
          kind: l.kind,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          workDays: l.workDays,
          dailyRate: l.dailyRate,
          amount: l.amount,
        })),
      );
      breakdownMetaByTx.set(tx.id, {
        vendor: tx.breakdownVendor,
        status: tx.breakdownStatus,
        note: tx.breakdownNote,
      });
    }
  }

  const rowMeta = new Map<
    string,
    {
      entry: "tx" | "advance";
      entityId: string;
      proofUrl: string | null;
      createdBy?: string;
      isMandorExpense?: boolean;
      amount?: number;
    }
  >();
  for (const tx of transactions) {
    rowMeta.set(`tx-${tx.id}`, {
      entry: "tx",
      entityId: tx.id,
      proofUrl: tx.proofUrl,
      createdBy: tx.createdBy.name,
      isMandorExpense: tx.isMandorExpense,
      amount: tx.amount,
    });
  }
  for (const a of advances) {
    rowMeta.set(`adv-${a.id}`, {
      entry: "advance",
      entityId: a.id,
      proofUrl: a.proofUrl,
    });
  }

  const bookRows: BookRow[] = bookChrono.map((row) => {
    const meta = rowMeta.get(row.id);
    const lines =
      meta?.isMandorExpense && meta.entityId
        ? (expenseLinesByTx.get(meta.entityId) ?? [])
        : [];
    const bd = meta?.entityId
      ? breakdownMetaByTx.get(meta.entityId)
      : undefined;

    return {
      id: row.id,
      date: row.date,
      keterangan: (
        <>
          <span className="text-teal-900/55">{row.kind}</span>
          {" · "}
          {row.description}
          {meta?.createdBy ? (
            <span className="text-teal-900/55"> · {meta.createdBy}</span>
          ) : null}
        </>
      ),
      meta: row.sourceName,
      penerimaan: row.debit,
      pengeluaran: row.credit,
      saldo: row.balance,
      skipBalance: row.skipBalance,
      proofHref: meta?.proofUrl,
      proofTitle: row.description,
      extra:
        meta?.isMandorExpense && meta.amount != null ? (
          <MandorExpenseBreakdownForm
            transactionId={meta.entityId}
            proofAmount={meta.amount}
            lines={lines}
            canEdit={canBreakDown}
            vendor={bd?.vendor}
            status={bd?.status ?? "PENDING"}
            rejectNote={bd?.note}
            defaultOpen={false}
          />
        ) : null,
      actions:
        canMutate && meta?.entry === "tx" && !meta.isMandorExpense ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/transactions/${meta.entityId}/edit`}
              className="text-teal-700 underline"
            >
              Edit
            </Link>
            <form action={deleteTransactionAction}>
              <input type="hidden" name="id" value={meta.entityId} />
              <button type="submit" className="text-rose-700 underline">
                Hapus
              </button>
            </form>
          </div>
        ) : canMutate && meta?.entry === "advance" ? (
          <form action={deleteContractorAdvanceAction}>
            <input type="hidden" name="id" value={meta.entityId} />
            <button type="submit" className="text-rose-700 underline">
              Hapus
            </button>
          </form>
        ) : null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Kas Proyek"
        description="Buku kas per proyek. Baris * = bukti Mandor (laporan, tidak potong saldo)."
        actions={
          <div className="flex flex-wrap gap-2">
            {!readOnlyAdmin ? (
              <Link href="/transactions" className={btnSecondaryClass}>
                Kas Besar
              </Link>
            ) : null}
            {owner ? (
              <Link href="/transactions/new" className={btnSecondaryClass}>
                + Catat transaksi
              </Link>
            ) : null}
          </div>
        }
      />

      <Card className="mb-4 print:hidden">
        <form className="grid gap-3 sm:grid-cols-4">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Cari keterangan…"
            className="min-h-11 rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-600 sm:col-span-2 sm:text-sm"
          />
          <select
            name="projectId"
            defaultValue={params.projectId ?? ""}
            className="min-h-11 rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-600 sm:text-sm"
            required
          >
            <option value="">Pilih proyek…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {tidyCase(p.name)}
              </option>
            ))}
          </select>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="type"
              defaultValue={params.type ?? ""}
              className="min-h-11 w-full rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-600 sm:text-sm"
            >
              <option value="">Semua</option>
              <option value="INCOME">Penerimaan</option>
              <option value="EXPENSE">Pengeluaran</option>
            </select>
            <button
              type="submit"
              className="min-h-11 shrink-0 rounded-xl bg-teal-800 px-4 text-sm font-medium text-white"
            >
              Filter
            </button>
          </div>
        </form>
      </Card>

      {needsProject ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <p className="text-sm text-amber-950">
            Pilih proyek di filter untuk membuka buku kas.
          </p>
        </Card>
      ) : (
        <>
          <BookSummaryStrip
            items={[
              {
                label: "Penerimaan",
                value: formatRupiah(totalIn),
                tone: "in",
              },
              {
                label: "Pengeluaran",
                value: formatRupiah(totalOut),
                hint: "Tanpa bukti Mandor",
                tone: "out",
              },
              {
                label: "Saldo",
                value: formatRupiah(saldoAkhir),
                tone: "bal",
              },
            ]}
          />

          <Card className="overflow-hidden p-3 sm:p-4">
            <p className="mb-2 text-xs text-teal-900/55">
              {tidyCase(projectsInScope[0]?.name ?? "Proyek")} · urut tanggal
              · * = laporan
            </p>
            <BookLedgerTable
              rows={bookRows}
              opening={opening}
              empty="Belum ada mutasi."
              footnote="* tidak potong kas"
            />
          </Card>
        </>
      )}
    </div>
  );
}
