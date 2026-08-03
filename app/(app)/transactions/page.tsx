import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { deleteContractorAdvanceAction } from "@/lib/actions/contractor";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import { isOwner, isAdmin, requireSession } from "@/lib/auth";
import { getGlobalCashBreakdown } from "@/lib/balance";
import {
  buildRunningBalance,
  moneyCell,
  sumCashMovements,
  type LedgerLine,
} from "@/lib/report-ledger";
import {
  getLinkedProofsForAdvances,
  getLinkedProofsForDisbursements,
} from "@/lib/mandor-pencairan";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import { DisbursementProofDetails } from "@/components/DisbursementProofDetails";
import { ProofReviewLink } from "@/components/ProofReviewLink";
import {
  btnSecondaryClass,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";

/**
 * Kas Besar — pemasukan owner + outflow nyata (termasuk termin/pencairan Mandor).
 * Bukti Mandor TIDAK menjadi baris kredit; tampil sebagai breakdown di bawah pencairan.
 */
export default async function KasBesarPage({
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
  const admin = owner;
  const params = await searchParams;
  const hasTypeFilter =
    params.type === "INCOME" || params.type === "EXPENSE";
  const includeAdvances = params.type !== "INCOME";

  // Admin diarahkan ke Kas Proyek (wajib pilih proyek)
  if (readOnlyAdmin) {
    const q = new URLSearchParams();
    if (params.projectId) q.set("projectId", params.projectId);
    if (params.q) q.set("q", params.q);
    if (params.type) q.set("type", params.type);
    redirect(
      `/transactions/project${q.toString() ? `?${q.toString()}` : ""}`,
    );
  }

  const where = {
    isMandorExpense: false,
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(hasTypeFilter ? { type: params.type as "INCOME" | "EXPENSE" } : {}),
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
            {
              contractor: {
                project: { location: { contains: params.q } },
              },
            },
          ],
        }
      : {}),
  };

  const [transactions, advances, projects, kasBesar] = await Promise.all([
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
        mandorDisbursement: { select: { id: true } },
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
    getGlobalCashBreakdown(),
  ]);

  const disbursementIds = transactions
    .filter((tx) => tx.isMandorDisbursement && tx.mandorDisbursement?.id)
    .map((tx) => tx.mandorDisbursement!.id);
  // Also find MandorDisbursement by transaction relation reverse — already have via mandorDisbursement
  const advanceIds = advances.map((a) => a.id);

  const [proofsByDisbursement, proofsByAdvance] = await Promise.all([
    getLinkedProofsForDisbursements(disbursementIds),
    getLinkedProofsForAdvances(advanceIds),
  ]);

  const proofsMapD = new Map<string, typeof proofsByDisbursement>();
  for (const p of proofsByDisbursement) {
    const k = p.linkedMandorDisbursementId!;
    const list = proofsMapD.get(k) ?? [];
    list.push(p);
    proofsMapD.set(k, list);
  }
  const proofsMapA = new Map<string, typeof proofsByAdvance>();
  for (const p of proofsByAdvance) {
    const k = p.linkedContractorAdvanceId!;
    const list = proofsMapA.get(k) ?? [];
    list.push(p);
    proofsMapA.set(k, list);
  }

  const projectsInScope = params.projectId
    ? projects.filter((p) => p.id === params.projectId)
    : projects;

  const opening =
    !params.q && !hasTypeFilter
      ? projectsInScope.reduce((sum, p) => sum + p.openingBalance, 0)
      : 0;

  const ledgerLines: LedgerLine[] = [
    ...transactions.map((tx) => ({
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
            : tx.isMandorDisbursement
              ? "Pembayaran ke Mandor"
              : tx.isOwnerPersonal
                ? "Ambil pribadi"
                : tx.isFromGlobalCash
                  ? "Masuk kas besar"
                  : "Pengeluaran",
      description: tx.fundingStage
        ? `${tidyCase(tx.category.name)} — ${tidyCase(tx.description)} · ${tidyCase(tx.fundingStage.name)}`
        : tx.isOwnerPersonal && tx.type === "EXPENSE" && !tx.isFeeTransfer
          ? `${tidyCase(tx.description)} · dari kas besar (bukan biaya proyek)`
          : `${tidyCase(tx.category.name)} — ${tidyCase(tx.description)}`,
      debit: tx.type === "INCOME" ? tx.amount : 0,
      credit: tx.type === "EXPENSE" ? tx.amount : 0,
      skipBalance: tx.type === "EXPENSE" && tx.isFromGlobalCash,
    })),
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

  const rowMeta = new Map<
    string,
    {
      entry: "tx" | "advance";
      entityId: string;
      proofUrl: string | null;
      createdBy?: string;
      amount: number;
      disbursementId?: string;
      advanceId?: string;
    }
  >();
  for (const tx of transactions) {
    rowMeta.set(`tx-${tx.id}`, {
      entry: "tx",
      entityId: tx.id,
      proofUrl: tx.proofUrl,
      createdBy: tx.createdBy.name,
      amount: tx.amount,
      disbursementId: tx.mandorDisbursement?.id,
    });
  }
  for (const a of advances) {
    rowMeta.set(`adv-${a.id}`, {
      entry: "advance",
      entityId: a.id,
      proofUrl: a.proofUrl,
      amount: a.amount,
      advanceId: a.id,
    });
  }

  return (
    <div>
      <PageHeader
        title="Kas Besar"
        description="Pemasukan ke owner dan pembayaran ke Mandor/Pemborong. Bukti belanja Mandor tidak menambah kredit di sini — lihat breakdown di bawah pencairan."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/transactions/project" className={btnSecondaryClass}>
              Kas Proyek
            </Link>
            {owner ? (
              <Link href="/transactions/new" className={btnSecondaryClass}>
                + Catat transaksi
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryPill
          label="Kas besar (saat ini)"
          value={formatRupiah(kasBesar.total)}
          hint={`Tunai ${formatRupiah(kasBesar.cash)} · Bank ${formatRupiah(kasBesar.bank)}`}
          tone="bal"
        />
        <SummaryPill
          label="Debit (masuk)"
          value={formatRupiah(totalDebit + (opening > 0 ? opening : 0))}
          hint={
            opening > 0
              ? `Termasuk saldo awal ${formatRupiah(opening)}`
              : "Pemasukan dalam filter"
          }
          tone="in"
        />
        <SummaryPill
          label="Kredit (keluar)"
          value={formatRupiah(totalCredit)}
          hint="Pengeluaran nyata + pembayaran Mandor/Pemborong"
          tone="out"
        />
        <SummaryPill
          label="Saldo buku (filter)"
          value={formatRupiah(saldoAkhir)}
          hint="Saldo setelah semua mutasi (terbaru di atas)"
          tone="bal"
        />
      </div>

      <Card className="mb-4 print:hidden">
        <form className="grid gap-3 sm:grid-cols-4">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Cari uraian / proyek / sumber / kategori"
            className="min-h-11 rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-600 sm:col-span-2 sm:text-sm"
          />
          <select
            name="projectId"
            defaultValue={params.projectId ?? ""}
            className="min-h-11 rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-base outline-none focus:border-teal-600 sm:text-sm"
          >
            <option value="">Semua proyek</option>
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
                : "Gabungan semua proyek"}
            </p>
            <p className="text-teal-900/55">
              Terbaru di atas · Debit = masuk · Kredit = keluar · Saldo
              berjalan
            </p>
          </div>
        </div>

        {book.length === 0 && opening <= 0 ? (
          <div className="p-5">
            <EmptyState message="Belum ada mutasi yang cocok." />
          </div>
        ) : (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-teal-900/15 text-sm text-teal-900/55">
                  <th className="px-4 py-3 pr-3 font-medium sm:px-5">
                    Tanggal
                  </th>
                  <th className="py-3 pr-3 font-medium">Proyek</th>
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
                  const dProofs = meta?.disbursementId
                    ? (proofsMapD.get(meta.disbursementId) ?? [])
                    : [];
                  const aProofs = meta?.advanceId
                    ? (proofsMapA.get(meta.advanceId) ?? [])
                    : [];
                  const linkedProofs =
                    meta?.entry === "advance"
                      ? aProofs
                      : meta?.disbursementId
                        ? dProofs
                        : [];
                  const showBreakdown =
                    Boolean(meta?.advanceId) || Boolean(meta?.disbursementId);

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-teal-900/6 odd:bg-white/40"
                    >
                      <td className="px-4 py-3 pr-3 whitespace-nowrap text-teal-950 sm:px-5">
                        {format(row.date, "dd/MM/yyyy")}
                      </td>
                      <td className="py-3 pr-3 text-teal-950">
                        {row.projectId ? (
                          <Link
                            href={`/projects/${row.projectId}`}
                            className="hover:underline"
                          >
                            {row.projectName}
                          </Link>
                        ) : (
                          row.projectName
                        )}
                        <span className="text-teal-900/55">
                          {" "}
                          · {row.location}
                        </span>
                      </td>
                      <td className="max-w-md py-3 pr-3 text-teal-950">
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
                            <ProofReviewLink
                              href={meta.proofUrl}
                              title={row.description}
                            >
                              Lihat bukti
                            </ProofReviewLink>
                          </>
                        ) : null}
                        {showBreakdown && meta ? (
                          <DisbursementProofDetails
                            cairAmount={meta.amount}
                            proofs={linkedProofs.map((p) => ({
                              id: p.id,
                              date: p.date,
                              amount: p.amount,
                              description: p.description,
                              proofUrl: p.proofUrl,
                              mandorName: p.createdBy.name,
                            }))}
                          />
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-teal-950">
                        {row.sourceName}
                      </td>
                      <td className="py-3 pr-2 text-right whitespace-nowrap tabular-nums text-emerald-800">
                        {moneyCell(row.debit)}
                      </td>
                      <td className="py-3 pr-2 text-right whitespace-nowrap tabular-nums text-rose-800">
                        {moneyCell(row.credit)}
                      </td>
                      <td
                        className={`py-3 pr-3 text-right whitespace-nowrap tabular-nums ${
                          row.balance < 0 ? "text-rose-700" : "text-teal-950"
                        }`}
                      >
                        {formatRupiah(row.balance)}
                      </td>
                      <td className="py-3 pr-4 sm:pr-5 print:hidden">
                        {meta?.proofUrl ? (
                          <ProofReviewLink
                            href={meta.proofUrl}
                            title={row.description}
                            className="mr-3 text-sm font-medium text-teal-700 underline"
                          >
                            Lihat bukti
                          </ProofReviewLink>
                        ) : null}
                        {admin && meta?.entry === "tx" ? (
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
                        ) : admin && meta?.entry === "advance" ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              href={`/projects/${row.projectId}`}
                              className="text-sm text-teal-700 underline"
                            >
                              Proyek
                            </Link>
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
                    <td className="py-3 pr-3 text-teal-900/55">—</td>
                    <td className="py-3 pr-3 text-teal-950">
                      Saldo awal
                      {params.projectId ? "" : " (gabungan proyek)"}
                    </td>
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
                    colSpan={4}
                    className="px-4 py-3 pr-3 text-right font-medium text-teal-950 sm:px-5"
                  >
                    Saldo akhir
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
