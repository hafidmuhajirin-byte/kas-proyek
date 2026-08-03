import Link from "next/link";
import { format } from "date-fns";
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
  moneyCell,
  sumCashMovements,
  type LedgerLine,
} from "@/lib/report-ledger";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import {
  MandorExpenseBreakdownForm,
  type ExpenseLineRow,
} from "@/components/MandorExpenseBreakdownForm";
import {
  btnSecondaryClass,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";

/**
 * Kas Proyek — mutasi per proyek termasuk bukti Mandor sebagai laporan pemakaian dana.
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
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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
                ? "Belanja Mandor (laporan)"
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
  const book = [...bookChrono].reverse();

  const cashMoves = sumCashMovements(bookChrono);
  const totalDebit = cashMoves.debit;
  const totalCredit = cashMoves.credit;
  const saldoAkhir =
    bookChrono.length > 0
      ? bookChrono[bookChrono.length - 1].balance
      : opening;

  const expenseLinesByTx = new Map<string, ExpenseLineRow[]>();
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
          workDays: l.workDays,
          dailyRate: l.dailyRate,
          amount: l.amount,
        })),
      );
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

  return (
    <div>
      <PageHeader
        title="Kas Proyek"
        description="Mutasi per proyek termasuk bukti belanja Mandor (laporan pemakaian dana cair) dan pecahan Admin."
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

      {needsProject ? (
        <Card className="mb-4 border-amber-200 bg-amber-50/80">
          <p className="text-sm text-amber-950">
            Pilih satu proyek di filter di bawah untuk menampilkan buku kas
            proyek.
          </p>
        </Card>
      ) : null}

      {!needsProject ? (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <SummaryPill
            label="Debit (masuk)"
            value={formatRupiah(totalDebit + (opening > 0 ? opening : 0))}
            tone="in"
          />
          <SummaryPill
            label="Kredit kas (keluar nyata)"
            value={formatRupiah(totalCredit)}
            hint="Tidak termasuk bukti Mandor"
            tone="out"
          />
          <SummaryPill
            label="Saldo proyek"
            value={formatRupiah(saldoAkhir)}
            tone="bal"
          />
        </div>
      ) : null}

      <Card className="mb-4 print:hidden">
        <form className="grid gap-3 sm:grid-cols-4">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Cari uraian / sumber / kategori"
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
              <option value="">Semua jenis</option>
              <option value="INCOME">Debit (masuk)</option>
              <option value="EXPENSE">Kredit (keluar)</option>
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

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-teal-900/10 bg-teal-950/[0.03] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-medium text-teal-950">
              {params.projectId
                ? projectsInScope[0]?.name ?? "Proyek"
                : "Pilih proyek"}
            </p>
            <p className="text-teal-900/55">
              Bukti Mandor = laporan (tidak potong saldo)
            </p>
          </div>
        </div>

        {needsProject || (book.length === 0 && opening <= 0) ? (
          <div className="p-5">
            <EmptyState
              message={
                needsProject
                  ? "Pilih proyek untuk melihat mutasi."
                  : "Belum ada mutasi yang cocok."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-teal-900/15 text-sm text-teal-900/55">
                  <th className="px-4 py-3 pr-3 font-medium sm:px-5">
                    Tanggal
                  </th>
                  <th className="py-3 pr-3 font-medium">Uraian</th>
                  <th className="py-3 pr-3 font-medium">Sumber</th>
                  <th className="py-3 pr-2 text-right font-medium">Debit</th>
                  <th className="py-3 pr-2 text-right font-medium">Kredit</th>
                  <th className="py-3 pr-3 text-right font-medium">Saldo</th>
                  <th className="py-3 pr-4 font-medium sm:pr-5 print:hidden">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {book.map((row) => {
                  const meta = rowMeta.get(row.id);
                  const lines =
                    meta?.isMandorExpense && meta.entityId
                      ? (expenseLinesByTx.get(meta.entityId) ?? [])
                      : [];

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-teal-900/6 ${
                        meta?.isMandorExpense
                          ? "bg-amber-50/40"
                          : "odd:bg-white/40"
                      }`}
                    >
                      <td className="px-4 py-3 pr-3 whitespace-nowrap align-top text-teal-950 sm:px-5">
                        {format(row.date, "dd/MM/yyyy")}
                      </td>
                      <td className="max-w-lg py-3 pr-3 align-top text-teal-950">
                        <span className="text-teal-900/55">{row.kind}</span>
                        {" · "}
                        {row.description}
                        {meta?.createdBy ? (
                          <span className="text-teal-900/55">
                            {" "}
                            · {meta.createdBy}
                          </span>
                        ) : null}
                        {meta?.proofUrl ? (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={meta.proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-teal-700 underline"
                            >
                              Lihat bukti
                            </a>
                          </>
                        ) : null}
                        {meta?.isMandorExpense && meta.amount != null ? (
                          <MandorExpenseBreakdownForm
                            transactionId={meta.entityId}
                            proofAmount={meta.amount}
                            lines={lines}
                            canEdit={canBreakDown}
                          />
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 align-top whitespace-nowrap text-teal-950">
                        {row.sourceName}
                      </td>
                      <td className="py-3 pr-2 align-top text-right whitespace-nowrap tabular-nums text-emerald-800">
                        {moneyCell(row.debit)}
                      </td>
                      <td className="py-3 pr-2 align-top text-right whitespace-nowrap tabular-nums text-rose-800">
                        {meta?.isMandorExpense ? (
                          <span className="text-amber-800/80">
                            {moneyCell(row.credit)}*
                          </span>
                        ) : (
                          moneyCell(row.credit)
                        )}
                      </td>
                      <td
                        className={`py-3 pr-3 align-top text-right whitespace-nowrap tabular-nums ${
                          row.balance < 0 ? "text-rose-700" : "text-teal-950"
                        }`}
                      >
                        {formatRupiah(row.balance)}
                      </td>
                      <td className="py-3 pr-4 align-top sm:pr-5 print:hidden">
                        {canMutate && meta?.entry === "tx" && !meta.isMandorExpense ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              href={`/transactions/${meta.entityId}/edit`}
                              className="text-sm text-teal-700 underline"
                            >
                              Edit
                            </Link>
                            <form action={deleteTransactionAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={meta.entityId}
                              />
                              <button
                                type="submit"
                                className="text-sm text-rose-700 underline"
                              >
                                Hapus
                              </button>
                            </form>
                          </div>
                        ) : canMutate && meta?.entry === "advance" ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <form action={deleteContractorAdvanceAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={meta.entityId}
                              />
                              <button
                                type="submit"
                                className="text-sm text-rose-700 underline"
                              >
                                Hapus
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-teal-900/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {opening > 0 ? (
                  <tr className="border-b border-teal-900/8 bg-teal-50/50">
                    <td className="px-4 py-3 pr-3 whitespace-nowrap text-teal-900/55 sm:px-5">
                      —
                    </td>
                    <td className="py-3 pr-3 text-teal-950">Saldo awal</td>
                    <td className="py-3 pr-3 text-teal-900/55">—</td>
                    <td className="py-3 pr-2 text-right whitespace-nowrap tabular-nums text-emerald-800">
                      {moneyCell(opening)}
                    </td>
                    <td className="py-3 pr-2 text-right text-teal-900/40">—</td>
                    <td className="py-3 pr-3 text-right whitespace-nowrap tabular-nums text-teal-950">
                      {formatRupiah(opening)}
                    </td>
                    <td className="py-3 pr-4 text-teal-900/40 sm:pr-5 print:hidden">
                      —
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t border-teal-900/15 bg-teal-950/[0.03] text-sm">
                  <td
                    colSpan={3}
                    className="px-4 py-3 pr-3 text-right font-medium text-teal-950 sm:px-5"
                  >
                    Saldo akhir · * = laporan (tidak potong kas)
                  </td>
                  <td className="py-3 pr-2 text-right whitespace-nowrap tabular-nums text-emerald-800">
                    {moneyCell(totalDebit + (opening > 0 ? opening : 0))}
                  </td>
                  <td className="py-3 pr-2 text-right whitespace-nowrap tabular-nums text-rose-800">
                    {moneyCell(totalCredit)}
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap tabular-nums font-medium text-teal-950">
                    {formatRupiah(saldoAkhir)}
                  </td>
                  <td className="py-3 pr-4 sm:pr-5 print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "in" | "out" | "bal";
}) {
  const color =
    tone === "in"
      ? "text-emerald-800"
      : tone === "out"
        ? "text-rose-800"
        : tone === "bal"
          ? "text-teal-900"
          : "text-teal-950";

  return (
    <div className="min-w-0 rounded-xl border border-teal-900/10 bg-[var(--surface)] px-3 py-3 text-sm sm:px-4">
      <p className="text-teal-900/55">{label}</p>
      <p
        className={`mt-1 min-w-0 break-words tabular-nums font-medium ${color}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-teal-900/55">{hint}</p>
      ) : null}
    </div>
  );
}
