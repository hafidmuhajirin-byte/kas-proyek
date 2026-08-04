import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteContractorAdvanceAction } from "@/lib/actions/contractor";
import { deleteTransactionAction } from "@/lib/actions/transactions";
import { isOwner, isAdmin, requireSession } from "@/lib/auth";
import { getGlobalCashBreakdown } from "@/lib/balance";
import {
  buildRunningBalance,
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
import {
  BookLedgerTable,
  BookSummaryStrip,
  type BookRow,
} from "@/components/BookLedgerTable";
import { DisbursementProofDetails } from "@/components/DisbursementProofDetails";
import {
  btnSecondaryClass,
  Card,
  PageHeader,
} from "@/components/ui";

/**
 * Kas Besar — buku kas pusat (Penerimaan / Pengeluaran / Saldo).
 * Bukti Mandor tidak menambah pengeluaran; tampil di bawah pencairan.
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
  const includeAdvances = false; // Termin digabung ke Dana ke Mandor

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
    getGlobalCashBreakdown(),
  ]);

  const disbursementIds = transactions
    .filter((tx) => tx.isMandorDisbursement && tx.mandorDisbursement?.id)
    .map((tx) => tx.mandorDisbursement!.id);
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

  const cashMoves = sumCashMovements(bookChrono);
  const totalIn = cashMoves.debit + (opening > 0 ? opening : 0);
  const totalOut = cashMoves.credit;
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

  const bookRows: BookRow[] = bookChrono.map((row) => {
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

    return {
      id: row.id,
      date: row.date,
      projectLabel: row.projectName,
      projectHref: row.projectId ? `/projects/${row.projectId}` : undefined,
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
        showBreakdown && meta ? (
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
        ) : null,
      actions: admin ? (
        meta?.entry === "tx" ? (
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
        ) : meta?.entry === "advance" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/projects/${row.projectId}`}
              className="text-teal-700 underline"
            >
              Proyek
            </Link>
            <form action={deleteContractorAdvanceAction}>
              <input type="hidden" name="id" value={meta.entityId} />
              <button type="submit" className="text-rose-700 underline">
                Hapus
              </button>
            </form>
          </div>
        ) : null
      ) : null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Kas Besar"
        description="Buku kas pusat — penerimaan, pengeluaran, saldo. Bukti Mandor di bawah pencairan."
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

      <BookSummaryStrip
        items={[
          {
            label: "Kas saat ini",
            value: formatRupiah(kasBesar.total),
            hint: `Tunai ${formatRupiah(kasBesar.cash)} · Bank ${formatRupiah(kasBesar.bank)}`,
            tone: "bal",
          },
          {
            label: "Penerimaan",
            value: formatRupiah(totalIn),
            tone: "in",
          },
          {
            label: "Pengeluaran",
            value: formatRupiah(totalOut),
            tone: "out",
          },
          {
            label: "Saldo buku",
            value: formatRupiah(saldoAkhir),
            tone: "bal",
          },
        ]}
      />

      <Card className="mb-4 print:hidden">
        <form className="grid gap-3 sm:grid-cols-4">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Cari keterangan / proyek…"
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

      <Card className="overflow-hidden p-3 sm:p-4">
        <p className="mb-2 text-xs text-teal-900/55">
          {params.projectId
            ? tidyCase(projectsInScope[0]?.name ?? "Proyek")
            : "Semua proyek"}{" "}
          · terbaru di atas
        </p>
        <BookLedgerTable
          rows={bookRows}
          opening={opening}
          showProject
          newestFirst
          empty="Belum ada mutasi."
        />
      </Card>
    </div>
  );
}
