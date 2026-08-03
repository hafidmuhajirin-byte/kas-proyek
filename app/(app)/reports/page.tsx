import { format, parseISO, endOfDay, startOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { PrintButton } from "@/components/PrintButton";
import {
  btnSecondaryClass,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getGlobalCashBreakdown } from "@/lib/balance";
import {
  buildRunningBalance,
  moneyCell,
  type LedgerLine,
} from "@/lib/report-ledger";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { tidyCase } from "@/lib/text";
import {
  billingModeLabels,
  categoryTypeLabels,
  projectStatusLabels,
} from "@/lib/labels";
import {
  fundKindFromCategoryName,
  projectFundKinds,
  projectFundLabels,
  type ProjectFundKind,
} from "@/lib/project-funds";
import { isOwnerPersonalDraw } from "@/lib/owner-personal";
import { PROJECT_FEE_PERCENT, calcFeeTransferQuota } from "@/lib/project-profit";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    location?: string;
    cashSourceId?: string;
    categoryId?: string;
    type?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireSession();
  const params = await searchParams;

  const from = params.from ? startOfDay(parseISO(params.from)) : undefined;
  const to = params.to ? endOfDay(parseISO(params.to)) : undefined;
  const hasTypeFilter =
    params.type === "INCOME" || params.type === "EXPENSE";
  const hasCategoryFilter = Boolean(params.categoryId);

  const where = {
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.cashSourceId ? { cashSourceId: params.cashSourceId } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(hasTypeFilter ? { type: params.type as "INCOME" | "EXPENSE" } : {}),
    ...(params.location
      ? { project: { location: { contains: params.location } } }
      : {}),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const advanceWhere = {
    ...(params.cashSourceId ? { cashSourceId: params.cashSourceId } : {}),
    ...((params.projectId || params.location) && {
      contractor: {
        ...(params.projectId ? { projectId: params.projectId } : {}),
        ...(params.location
          ? { project: { location: { contains: params.location } } }
          : {}),
      },
    }),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [allProjects, sources, categories, transactions, advances, kasBesar] =
    await Promise.all([
      prisma.project.findMany({
        orderBy: [{ status: "asc" }, { name: "asc" }],
        include: {
          contractor: {
            include: {
              advances: { select: { amount: true } },
              expenses: { select: { amount: true } },
            },
          },
          funds: true,
        },
      }),
      prisma.cashSource.findMany({ orderBy: { name: "asc" } }),
      prisma.category.findMany({
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        include: {
          project: true,
          cashSource: true,
          category: true,
        },
      }),
      hasCategoryFilter || params.type === "INCOME"
        ? Promise.resolve([])
        : prisma.contractorAdvance.findMany({
            where: advanceWhere,
            include: {
              cashSource: true,
              contractor: { include: { project: true } },
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          }),
      getGlobalCashBreakdown(),
    ]);

  let projectsInScope = allProjects;
  if (params.projectId) {
    projectsInScope = projectsInScope.filter((p) => p.id === params.projectId);
  }
  if (params.location) {
    const loc = params.location.toLowerCase();
    projectsInScope = projectsInScope.filter((p) =>
      p.location.toLowerCase().includes(loc),
    );
  }

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
            : tx.isMandorExpense
              ? "Belanja Mandor"
              : tx.isOwnerPersonal
                ? "Ambil pribadi"
                : tx.isFromGlobalCash
                  ? "Masuk kas besar"
                  : "Pengeluaran",
      description: `${tidyCase(tx.category.name)} — ${tidyCase(tx.description)}`,
      debit: tx.type === "INCOME" ? tx.amount : 0,
      credit: tx.type === "EXPENSE" ? tx.amount : 0,
      skipBalance:
        (tx.type === "EXPENSE" && tx.isFromGlobalCash) ||
        Boolean(tx.isMandorExpense),
    })),
    ...advances.map((a) => ({
      id: `adv-${a.id}`,
      date: a.date,
      projectId: a.contractor.projectId,
      projectName: tidyCase(a.contractor.project.name),
      location: tidyCase(a.contractor.project.location),
      sourceName: tidyCase(a.cashSource.name),
      kind: "Termin pemborong",
      description: `${tidyCase(a.contractor.name)} — ${tidyCase(a.description)}`,
      debit: 0,
      credit: a.amount,
    })),
  ];

  const openingGabungan =
    !params.cashSourceId && !hasCategoryFilter && !hasTypeFilter && !from && !to
      ? projectsInScope.reduce((sum, p) => sum + p.openingBalance, 0)
      : 0;

  const gabunganBook = buildRunningBalance(ledgerLines, openingGabungan, {
    honorSkipBalance: true,
  });
  const income = ledgerLines.reduce((sum, l) => sum + l.debit, 0);
  const expense = ledgerLines.reduce((sum, l) => sum + l.credit, 0);
  const posisiFilter =
    gabunganBook.length > 0
      ? gabunganBook[gabunganBook.length - 1].balance
      : openingGabungan;

  const printedAt = format(new Date(), "d MMMM yyyy, HH:mm", {
    locale: localeId,
  });
  const periodeLabel =
    from || to
      ? `${from ? format(from, "d MMM yyyy", { locale: localeId }) : "…"} — ${
          to ? format(to, "d MMM yyyy", { locale: localeId }) : "…"
        }`
      : "Semua periode (posisi terkini)";

  const ownerDrawTxs = transactions.filter((tx) => isOwnerPersonalDraw(tx));
  const ownerInjectTxs = transactions.filter(
    (tx) => tx.type === "INCOME" && tx.isOwnerPersonal,
  );
  const ownerDrawTotal = ownerDrawTxs.reduce((s, tx) => s + tx.amount, 0);
  const ownerInjectTotal = ownerInjectTxs.reduce((s, tx) => s + tx.amount, 0);

  const ownerByProject = [
    ...projectsInScope.map((project) => {
      const draws = ownerDrawTxs.filter((tx) => tx.projectId === project.id);
      const injects = ownerInjectTxs.filter((tx) => tx.projectId === project.id);
      const drawSum = draws.reduce((s, tx) => s + tx.amount, 0);
      const injectSum = injects.reduce((s, tx) => s + tx.amount, 0);
      const feeTarget = Math.round(
        (Math.max(project.contractValue, 0) * PROJECT_FEE_PERCENT) / 100,
      );
      const feeTransferred = transactions
        .filter(
          (tx) =>
            tx.projectId === project.id &&
            tx.type === "EXPENSE" &&
            tx.isFeeTransfer,
        )
        .reduce((s, tx) => s + tx.amount, 0);
      const feeQuota = calcFeeTransferQuota({
        feeTargetProfit: feeTarget,
        feeTransferred,
        ownerPersonalDraws: drawSum,
      });
      return {
        key: project.id,
        title: tidyCase(project.name),
        subtitle: tidyCase(project.location),
        draws,
        injects,
        drawSum,
        injectSum,
        feeQuota,
      };
    }),
    (() => {
      const draws = ownerDrawTxs.filter((tx) => !tx.projectId);
      const injects = ownerInjectTxs.filter((tx) => !tx.projectId);
      const drawSum = draws.reduce((s, tx) => s + tx.amount, 0);
      const injectSum = injects.reduce((s, tx) => s + tx.amount, 0);
      return {
        key: "no-project",
        title: "Tanpa proyek",
        subtitle: "Pembukuan dana pribadi owner",
        draws,
        injects,
        drawSum,
        injectSum,
        feeQuota: null as ReturnType<typeof calcFeeTransferQuota> | null,
      };
    })(),
  ].filter((row) => row.drawSum > 0 || row.injectSum > 0);

  const exportQuery = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) exportQuery.set(key, value);
  });

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Laporan Pembukuan"
          description="Pembukuan elit per proyek dan gabungan — siap cetak."
          actions={
            <>
              <PrintButton />
              <a
                href={`/api/reports/export?${exportQuery.toString()}`}
                className={btnSecondaryClass}
              >
                Ekspor CSV
              </a>
            </>
          }
        />

        <Card className="mb-6">
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <select
              name="projectId"
              defaultValue={params.projectId ?? ""}
              className="rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Semua proyek</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {tidyCase(p.name)}
                </option>
              ))}
            </select>
            <input
              name="location"
              defaultValue={params.location}
              placeholder="Filter lokasi"
              className="rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-sm"
            />
            <select
              name="cashSourceId"
              defaultValue={params.cashSourceId ?? ""}
              className="rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Semua sumber kas</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {tidyCase(s.name)}
                  {s.accountNumber ? ` · ${s.accountNumber}` : ""}
                </option>
              ))}
            </select>
            <select
              name="categoryId"
              defaultValue={params.categoryId ?? ""}
              className="rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {tidyCase(c.name)} ({categoryTypeLabels[c.type]})
                </option>
              ))}
            </select>
            <select
              name="type"
              defaultValue={params.type ?? ""}
              className="rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Semua jenis</option>
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
            </select>
            <input
              type="date"
              name="from"
              defaultValue={params.from}
              className="rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-sm"
            />
            <input
              type="date"
              name="to"
              defaultValue={params.to}
              className="rounded-xl border border-teal-900/15 bg-white px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-medium text-white"
            >
              Terapkan filter
            </button>
          </form>
        </Card>
      </div>

      {/* ===== DOKUMEN CETAK ===== */}
      <article className="ledger-doc mx-auto max-w-5xl bg-[#fbfaf6] text-teal-950 shadow-[0_8px_40px_rgba(15,61,58,0.08)] print:max-w-none print:bg-white print:shadow-none">
        <header className="ledger-cover border-b border-teal-900/15 px-6 py-8 sm:px-10">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-teal-800/70 uppercase">
            Sistem Kas Proyek
          </p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-teal-950 sm:text-4xl">
            Pembukuan Proyek
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-teal-900/65">
            Buku kas resmi — ringkasan gabungan dan pembukuan per proyek.
          </p>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-teal-900/55">Periode</p>
              <p className="mt-0.5 font-medium">{periodeLabel}</p>
            </div>
            <div>
              <p className="text-teal-900/55">Dicetak</p>
              <p className="mt-0.5 font-medium">{printedAt}</p>
            </div>
            <div>
              <p className="text-teal-900/55">Cakupan</p>
              <p className="mt-0.5 font-medium">
                {params.projectId
                  ? tidyCase(projectsInScope[0]?.name ?? "1 proyek")
                  : `${projectsInScope.length} proyek`}
              </p>
            </div>
          </div>
        </header>

        {/* Kas besar terkini */}
        <section className="border-b border-teal-900/10 px-6 py-6 sm:px-10">
          <h2 className="font-serif text-xl text-teal-950">
            I. Posisi Kas Besar (Terkini)
          </h2>
          <p className="mt-1 text-xs text-teal-900/55">
            Sinkron dengan dashboard — Tunai + Bank semua proyek.
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-teal-900/10 bg-white px-4 py-3">
              <p className="text-teal-900/55">Total</p>
              <p className="mt-1 whitespace-nowrap tabular-nums font-medium text-teal-950">
                {formatRupiah(kasBesar.total)}
              </p>
            </div>
            <div className="rounded-lg border border-teal-900/10 bg-white px-4 py-3">
              <p className="text-teal-900/55">Tunai</p>
              <p className="mt-1 whitespace-nowrap tabular-nums font-medium text-teal-950">
                {formatRupiah(kasBesar.cash)}
              </p>
            </div>
            <div className="rounded-lg border border-teal-900/10 bg-white px-4 py-3">
              <p className="text-teal-900/55">Bank</p>
              <p className="mt-1 whitespace-nowrap tabular-nums font-medium text-teal-950">
                {formatRupiah(kasBesar.bank)}
              </p>
            </div>
          </div>
        </section>

        {/* Gabungan */}
        <section className="ledger-section border-b border-teal-900/10 px-6 py-6 sm:px-10 print:break-inside-avoid">
          <h2 className="font-serif text-xl text-teal-950">
            II. Pembukuan Gabungan
          </h2>
          <p className="mt-1 text-xs text-teal-900/55">
            Arus kas semua proyek dalam filter. Debit = masuk, Kredit = keluar
            (termasuk termin pemborong).
          </p>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
            <SummaryPill label="Saldo awal" value={formatRupiah(openingGabungan)} />
            <SummaryPill
              label="Pemasukan"
              value={formatRupiah(income)}
              tone="in"
            />
            <SummaryPill
              label="Pengeluaran"
              value={formatRupiah(expense)}
              tone="out"
            />
            <SummaryPill
              label="Posisi (filter)"
              value={formatRupiah(posisiFilter)}
              tone="bal"
            />
          </div>

          <LedgerTable
            rows={gabunganBook}
            opening={openingGabungan}
            showProject
            empty="Belum ada mutasi untuk filter ini."
          />
        </section>

        {/* Per proyek */}
        <section className="px-6 py-6 sm:px-10">
          <h2 className="font-serif text-xl text-teal-950">
            III. Pembukuan per Proyek
          </h2>
          <p className="mt-1 text-xs text-teal-900/55">
            Buku kas masing-masing proyek — siap dilampirkan ke laporan lapangan.
          </p>

          {projectsInScope.length === 0 ? (
            <div className="mt-6">
              <EmptyState message="Tidak ada proyek dalam cakupan filter." />
            </div>
          ) : (
            <div className="mt-6 space-y-10">
              {projectsInScope.map((project, index) => {
                const projectLines = ledgerLines
                  .filter((l) => l.projectId === project.id)
                  .map((l) =>
                    l.kind === "Ambil pribadi"
                      ? { ...l, skipBalance: true }
                      : l,
                  );
                const opening =
                  !params.cashSourceId &&
                  !hasCategoryFilter &&
                  !hasTypeFilter &&
                  !from &&
                  !to
                    ? project.openingBalance
                    : 0;
                const book = buildRunningBalance(projectLines, opening, {
                  honorSkipBalance: true,
                });
                const masuk = projectLines.reduce((s, l) => s + l.debit, 0);
                const keluar = projectLines
                  .filter((l) => l.kind !== "Ambil pribadi")
                  .reduce((s, l) => s + l.credit, 0);
                const saldo =
                  book.length > 0 ? book[book.length - 1].balance : opening;
                const contractor = project.contractor;
                const termin = contractor
                  ? contractor.advances.reduce((s, a) => s + a.amount, 0)
                  : 0;
                const bukti = contractor
                  ? contractor.expenses.reduce((s, e) => s + e.amount, 0)
                  : 0;

                const spentByKind: Partial<Record<ProjectFundKind, number>> =
                  {};
                for (const tx of transactions) {
                  if (tx.projectId !== project.id || tx.type !== "EXPENSE") {
                    continue;
                  }
                  const kind = fundKindFromCategoryName(tx.category.name);
                  if (!kind) continue;
                  spentByKind[kind] = (spentByKind[kind] ?? 0) + tx.amount;
                }
                const fundByKind = new Map(
                  project.funds.map((f) => [f.kind, f.plannedAmount]),
                );
                const hasFundPlan = projectFundKinds.some(
                  (k) => (fundByKind.get(k) ?? 0) > 0 || (spentByKind[k] ?? 0) > 0,
                );

                return (
                  <div
                    key={project.id}
                    className="ledger-project break-inside-avoid border border-teal-900/12 bg-white print:border-black/20"
                  >
                    <div className="border-b border-teal-900/10 bg-[#f3f7f5] px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="text-teal-900/55">
                            Proyek {String(index + 1).padStart(2, "0")}
                          </p>
                          <h3 className="mt-1 text-base font-medium text-teal-950 sm:text-lg">
                            {tidyCase(project.name)}
                          </h3>
                          <p className="mt-1 text-teal-900/65">
                            {tidyCase(project.location)} ·{" "}
                            {projectStatusLabels[project.status]} ·{" "}
                            {billingModeLabels[project.billingMode]}
                          </p>
                        </div>
                        <div className="text-right">
                          {project.contractValue > 0 ? (
                            <>
                              <p className="text-teal-900/55">Nilai kontrak</p>
                              <p className="whitespace-nowrap tabular-nums font-medium">
                                {formatRupiah(project.contractValue)}
                              </p>
                            </>
                          ) : (
                            <p className="text-teal-900/50">
                              Tanpa nilai kontrak
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 border-b border-teal-900/8 px-5 py-4 text-sm sm:grid-cols-4">
                      <SummaryPill
                        label="Saldo awal"
                        value={formatRupiah(opening)}
                      />
                      <SummaryPill
                        label="Masuk"
                        value={formatRupiah(masuk)}
                        tone="in"
                      />
                      <SummaryPill
                        label="Keluar"
                        value={formatRupiah(keluar)}
                        tone="out"
                      />
                      <SummaryPill
                        label="Saldo kas"
                        value={formatRupiah(saldo)}
                        tone="bal"
                      />
                    </div>

                    {contractor ? (
                      <div className="border-b border-teal-900/8 px-5 py-3 text-sm text-teal-900/70">
                        <strong className="font-medium text-teal-950">
                          Pemborong: {tidyCase(contractor.name)}
                        </strong>
                        {" · "}
                        Borongan {formatRupiah(contractor.agreedAmount)}
                        {" · "}
                        Termin {formatRupiah(termin)}
                        {" · "}
                        Bukti {formatRupiah(bukti)}
                        {contractor.phone ? ` · ${contractor.phone}` : ""}
                      </div>
                    ) : null}

                    {hasFundPlan ? (
                      <div className="border-b border-teal-900/8 px-5 py-3 text-sm">
                        <p className="text-teal-900/55">Dana operasional</p>
                        <div className="mt-2 grid gap-1 sm:grid-cols-2">
                          {projectFundKinds.map((kind) => {
                            const planned = fundByKind.get(kind) ?? 0;
                            const spent = spentByKind[kind] ?? 0;
                            if (planned === 0 && spent === 0) return null;
                            return (
                              <p key={kind} className="text-teal-900/75">
                                <span className="font-medium text-teal-950">
                                  {projectFundLabels[kind]}
                                </span>
                                {": rencana "}
                                {formatRupiah(planned)}
                                {" · terpakai "}
                                {formatRupiah(spent)}
                                {" · sisa "}
                                {formatRupiah(planned - spent)}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="px-2 py-2 sm:px-4">
                      <LedgerTable
                        rows={book}
                        opening={opening}
                        showProject={false}
                        empty="Belum ada mutasi kas pada proyek ini."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Dana pribadi owner */}
        <section className="ledger-section border-b border-teal-900/10 px-6 py-6 sm:px-10 print:break-inside-avoid">
          <h2 className="font-serif text-xl text-teal-950">
            IV. Dana Pribadi Owner
          </h2>
          <p className="mt-1 text-xs text-teal-900/55">
            Setoran dan ambil pribadi — bukan pengeluaran proyek. Ambil pribadi
            mengurangi kas besar dan sisa target fee proyek.
          </p>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <SummaryPill
              label="Setoran pribadi"
              value={formatRupiah(ownerInjectTotal)}
              tone="in"
            />
            <SummaryPill
              label="Ambil pribadi"
              value={formatRupiah(ownerDrawTotal)}
              tone="out"
            />
            <SummaryPill
              label="Netto pribadi"
              value={formatRupiah(ownerInjectTotal - ownerDrawTotal)}
              tone="bal"
            />
          </div>

          {ownerByProject.length === 0 ? (
            <p className="mt-4 text-sm text-teal-900/55">
              Belum ada mutasi dana pribadi owner pada filter ini.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {ownerByProject.map(
                ({
                  key,
                  title,
                  subtitle,
                  draws,
                  injects,
                  drawSum,
                  injectSum,
                  feeQuota,
                }) => (
                  <div
                    key={key}
                    className="break-inside-avoid border border-teal-900/12 bg-white"
                  >
                    <div className="border-b border-teal-900/10 bg-[#f3f7f5] px-4 py-3 text-sm">
                      <p className="font-medium text-teal-950">{title}</p>
                      <p className="mt-0.5 text-teal-900/55">
                        {subtitle} · Setor {formatRupiah(injectSum)} · Ambil{" "}
                        {formatRupiah(drawSum)}
                        {feeQuota
                          ? ` · Target fee ${formatRupiah(feeQuota.feeTargetProfit)} · Sisa fee ${formatRupiah(feeQuota.remaining)}`
                          : ""}
                      </p>
                    </div>
                    <div className="divide-y divide-teal-900/8 px-4 text-sm">
                      {[...injects, ...draws]
                        .sort((a, b) => a.date.getTime() - b.date.getTime())
                        .map((tx) => (
                          <div
                            key={tx.id}
                            className="flex flex-wrap items-start justify-between gap-2 py-2.5"
                          >
                            <div>
                              <p className="text-teal-950">
                                {tx.type === "INCOME"
                                  ? "Setoran pribadi"
                                  : "Ambil pribadi"}{" "}
                                · {tidyCase(tx.description)}
                              </p>
                              <p className="text-teal-900/55">
                                {format(tx.date, "dd/MM/yyyy")} ·{" "}
                                {tidyCase(tx.cashSource.name)}
                              </p>
                            </div>
                            <p
                              className={`shrink-0 tabular-nums font-medium ${
                                tx.type === "INCOME"
                                  ? "text-emerald-800"
                                  : "text-rose-800"
                              }`}
                            >
                              {tx.type === "INCOME" ? "+" : "-"}
                              {formatRupiah(tx.amount)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        <footer className="border-t border-teal-900/15 px-6 py-8 sm:px-10">
          <div className="grid gap-8 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[10px] tracking-wide text-teal-900/45 uppercase">
                Dibuat oleh
              </p>
              <div className="mt-10 border-b border-teal-900/25" />
              <p className="mt-2 text-xs text-teal-900/50">Nama & tanda tangan</p>
            </div>
            <div>
              <p className="text-[10px] tracking-wide text-teal-900/45 uppercase">
                Mengetahui
              </p>
              <div className="mt-10 border-b border-teal-900/25" />
              <p className="mt-2 text-xs text-teal-900/50">Nama & tanda tangan</p>
            </div>
          </div>
          <p className="mt-8 text-center text-[10px] tracking-wide text-teal-900/40 uppercase">
            Dokumen pembukuan kas proyek · {printedAt}
          </p>
        </footer>
      </article>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
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
    <div className="rounded-md border border-teal-900/10 bg-white px-3 py-2 text-sm">
      <p className="text-teal-900/55">{label}</p>
      <p className={`mt-0.5 whitespace-nowrap tabular-nums font-medium ${color}`}>
        {value}
      </p>
    </div>
  );
}

function LedgerTable({
  rows,
  opening,
  showProject,
  empty,
}: {
  rows: ReturnType<typeof buildRunningBalance>;
  opening: number;
  showProject: boolean;
  empty: string;
}) {
  if (rows.length === 0 && opening === 0) {
    return (
      <p className="mt-4 px-2 text-sm text-teal-900/55">{empty}</p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-teal-900/15 text-sm text-teal-900/55">
            <th className="py-2.5 pr-3 font-medium">Tanggal</th>
            {showProject ? (
              <th className="py-2.5 pr-3 font-medium">Proyek</th>
            ) : null}
            <th className="py-2.5 pr-3 font-medium">Uraian</th>
            <th className="py-2.5 pr-3 font-medium">Sumber</th>
            <th className="py-2.5 pr-2 text-right font-medium">Debit</th>
            <th className="py-2.5 pr-2 text-right font-medium">Kredit</th>
            <th className="py-2.5 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {opening > 0 ? (
            <tr className="border-b border-teal-900/8 bg-teal-50/40">
              <td className="py-2.5 pr-3 whitespace-nowrap text-teal-900/55">
                —
              </td>
              {showProject ? (
                <td className="py-2.5 pr-3 text-teal-900/55">—</td>
              ) : null}
              <td className="py-2.5 pr-3 text-teal-950">Saldo awal</td>
              <td className="py-2.5 pr-3 text-teal-900/55">—</td>
              <td className="py-2.5 pr-2 text-right whitespace-nowrap tabular-nums text-emerald-800">
                {moneyCell(opening)}
              </td>
              <td className="py-2.5 pr-2 text-right text-teal-900/40">—</td>
              <td className="py-2.5 text-right whitespace-nowrap tabular-nums text-teal-950">
                {formatRupiah(opening)}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-teal-900/6">
              <td className="py-2.5 pr-3 whitespace-nowrap text-teal-950">
                {format(row.date, "dd/MM/yyyy")}
              </td>
              {showProject ? (
                <td className="py-2.5 pr-3 text-teal-950">
                  {row.projectName}
                  <span className="text-teal-900/55"> · {row.location}</span>
                </td>
              ) : null}
              <td className="max-w-md py-2.5 pr-3 text-teal-950">
                <span className="text-teal-900/55">{row.kind}</span>
                {" · "}
                {row.description}
              </td>
              <td className="py-2.5 pr-3 whitespace-nowrap text-teal-950">
                {row.sourceName}
              </td>
              <td className="py-2.5 pr-2 text-right whitespace-nowrap tabular-nums text-emerald-800">
                {moneyCell(row.debit)}
              </td>
              <td className="py-2.5 pr-2 text-right whitespace-nowrap tabular-nums text-rose-800">
                {moneyCell(row.credit)}
              </td>
              <td
                className={`py-2.5 text-right whitespace-nowrap tabular-nums ${
                  row.balance < 0 ? "text-rose-700" : "text-teal-950"
                }`}
              >
                {formatRupiah(row.balance)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-teal-900/15 text-sm">
            <td
              colSpan={showProject ? 4 : 3}
              className="py-3 pr-3 text-right font-medium text-teal-950"
            >
              Saldo akhir
            </td>
            <td className="py-3 pr-2 text-right whitespace-nowrap tabular-nums text-emerald-800">
              {moneyCell(
                rows.reduce((s, r) => s + r.debit, 0) +
                  (opening > 0 ? opening : 0),
              )}
            </td>
            <td className="py-3 pr-2 text-right whitespace-nowrap tabular-nums text-rose-800">
              {moneyCell(rows.reduce((s, r) => s + r.credit, 0))}
            </td>
            <td className="py-3 text-right whitespace-nowrap tabular-nums font-medium text-teal-950">
              {formatRupiah(
                rows.length > 0 ? rows[rows.length - 1].balance : opening,
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
