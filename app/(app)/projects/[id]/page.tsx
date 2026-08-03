import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import {
  createFundingStageAction,
  deleteFundingStageAction,
  updateFundingStageAction,
} from "@/lib/actions/funding";
import { updateProjectAction } from "@/lib/actions/projects";
import {
  createWorkItemAction,
  deleteWorkItemAction,
} from "@/lib/actions/work-items";
import { calcStageStatus, getGlobalCashBreakdown } from "@/lib/balance";
import {
  canBreakDownMandorExpense,
  isOwner,
  isAdmin,
  requireSession,
} from "@/lib/auth";
import { formatRupiah } from "@/lib/money";
import { getMandorFundSummariesFor } from "@/lib/mandor-fund";
import { MandorDisbursementPanel } from "@/components/MandorDisbursementPanel";
import { MandorExpensePanel } from "@/components/MandorExpensePanel";
import {
  billingModeHints,
  billingModeLabels,
  fundingStatusLabels,
  projectStatusLabels,
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import {
  SCHOOL_RESIDUAL_CATEGORY,
  SAVE_TO_GLOBAL_CATEGORY,
  type ProjectChecklistState,
} from "@/lib/project-completion";
import {
  fundKindFromCategoryName,
  projectFundKinds,
  type ProjectFundKind,
} from "@/lib/project-funds";
import { tidyCase } from "@/lib/text";
import { calcFeeTransferQuota, calcProjectProfit } from "@/lib/project-profit";
import { isOwnerPersonalDraw } from "@/lib/owner-personal";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { ContractorPanel } from "@/components/ContractorPanel";
import { ProjectBillingFields } from "@/components/ProjectBillingFields";
import { ProjectCompletionPanel } from "@/components/ProjectCompletionPanel";
import { ProjectFeeTransferPanel } from "@/components/ProjectFeeTransferPanel";
import { ProjectFundsPanel } from "@/components/ProjectFundsPanel";
import { ProjectProfitPanel } from "@/components/ProjectProfitPanel";
import { RupiahInput } from "@/components/RupiahInput";
import {
  btnDangerClass,
  btnSecondaryClass,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const admin = isOwner(user);
  const readOnlyAdmin = isAdmin(user);
  const canBreakDown = canBreakDownMandorExpense(user);
  const { id } = await params;

  const [project, sources, kasBesar, assignedMandors, disbursements] =
    await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        billingMode: true,
        openingBalance: true,
        contractValue: true,
        notes: true,
        checkPlanning: true,
        checkSupervision: true,
        checkManagement: true,
        checkTax: true,
        checkReporting: true,
        checkContractor: true,
        checkNoRetention: true,
        fundingStages: {
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            sequence: true,
            percent: true,
            plannedAmount: true,
            transactions: {
              where: { type: "INCOME" },
              select: { amount: true },
            },
          },
        },
        workItems: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            date: true,
            description: true,
            quantity: true,
            unit: true,
            amount: true,
            notes: true,
          },
        },
        transactions: {
          select: {
            id: true,
            date: true,
            type: true,
            amount: true,
            description: true,
            proofUrl: true,
            fundingStageId: true,
            isOwnerPersonal: true,
            isFeeTransfer: true,
            isMandorExpense: true,
            category: { select: { name: true, type: true } },
            cashSource: { select: { name: true } },
            createdBy: { select: { id: true, name: true } },
            linkedMandorDisbursement: {
              select: { label: true },
            },
            linkedContractorAdvance: {
              select: {
                description: true,
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
        },
        contractor: {
          include: {
            advances: {
              orderBy: [{ date: "desc" }, { createdAt: "desc" }],
              include: { cashSource: { select: { name: true } } },
            },
            expenses: {
              orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            },
          },
        },
        funds: true,
      },
    }),
    prisma.cashSource.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getGlobalCashBreakdown(),
    prisma.projectAssignment.findMany({
      where: { projectId: id, user: { role: "MANDOR" } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.mandorDisbursement.findMany({
      where: { projectId: id },
      orderBy: [{ sequence: "asc" }, { date: "asc" }],
      include: { mandor: { select: { name: true } } },
    }),
  ]);

  if (!project) notFound();

  const spentByKind: Partial<Record<ProjectFundKind, number>> = {};
  for (const tx of project.transactions) {
    if (tx.type !== "EXPENSE") continue;
    const kind = fundKindFromCategoryName(tx.category.name);
    if (kind) {
      spentByKind[kind] = (spentByKind[kind] ?? 0) + tx.amount;
      continue;
    }
    if (tx.category.name === SAVE_TO_GLOBAL_CATEGORY) {
      spentByKind.SAVE = (spentByKind.SAVE ?? 0) + tx.amount;
    }
  }

  const clientIncomeTotal = project.transactions
    .filter((tx) => tx.type === "INCOME" && !tx.isOwnerPersonal)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const ownerInjectionTotal = project.transactions
    .filter((tx) => tx.type === "INCOME" && tx.isOwnerPersonal)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const incomeTotal = clientIncomeTotal + ownerInjectionTotal;
  const ownerPersonalDraws = project.transactions
    .filter((tx) => isOwnerPersonalDraw(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const projectCashAffectingExpense = project.transactions
    .filter(
      (tx) =>
        tx.type === "EXPENSE" &&
        !isOwnerPersonalDraw(tx) &&
        !tx.isMandorExpense,
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expenseTotal = project.transactions
    .filter((tx) => tx.type === "EXPENSE" && !isOwnerPersonalDraw(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const operatingExpense = project.transactions
    .filter(
      (tx) =>
        tx.type === "EXPENSE" &&
        !tx.isOwnerPersonal &&
        !tx.isFeeTransfer &&
        !tx.isMandorExpense &&
        tx.category.name !== SCHOOL_RESIDUAL_CATEGORY,
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
  const feeTransferred = project.transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.isFeeTransfer)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const feeTransferRows = project.transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.isFeeTransfer)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      description: tx.description,
      cashSourceName: tx.cashSource.name,
      proofUrl: tx.proofUrl,
    }));
  const contractorAdvances = project.contractor
    ? project.contractor.advances.reduce((sum, a) => sum + a.amount, 0)
    : 0;
  const cashBalance =
    project.openingBalance +
    incomeTotal -
    projectCashAffectingExpense -
    contractorAdvances;
  const projectCash = cashBalance;

  const remainingPlannedFunds = projectFundKinds.reduce((sum, kind) => {
    const planned =
      project.funds.find((f) => f.kind === kind)?.plannedAmount ?? 0;
    const spent = spentByKind[kind] ?? 0;
    return sum + Math.max(0, planned - spent);
  }, 0);

  const checklist: ProjectChecklistState = {
    checkPlanning: project.checkPlanning,
    checkSupervision: project.checkSupervision,
    checkManagement: project.checkManagement,
    checkTax: project.checkTax,
    checkReporting: project.checkReporting,
    checkContractor: project.checkContractor,
    checkNoRetention: project.checkNoRetention,
  };

  const savePlanned =
    project.funds.find((f) => f.kind === "SAVE")?.plannedAmount ?? 0;
  const saveRemaining = Math.max(0, savePlanned - (spentByKind.SAVE ?? 0));

  const stages = project.fundingStages.map((stage) => {
    const receivedAmount = stage.transactions.reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );
    return {
      ...stage,
      receivedAmount,
      remainingAmount: Math.max(0, stage.plannedAmount - receivedAmount),
      progressPercent:
        stage.plannedAmount > 0
          ? Math.min(
              100,
              Math.round((receivedAmount / stage.plannedAmount) * 100),
            )
          : 0,
      status: calcStageStatus(receivedAmount, stage.plannedAmount),
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
  const profitPreview = calcProjectProfit({
    contractValue: project.contractValue,
    billingMode: project.billingMode,
    workCompletedValue,
    clientIncome: clientIncomeTotal,
    operatingExpense,
    contractorAdvances,
    remainingPlannedFunds,
    contingencyPercent: 0,
  });
  const feeQuota = calcFeeTransferQuota({
    feeTargetProfit: profitPreview.feeTargetProfit,
    feeTransferred,
    ownerPersonalDraws,
  });
  const receivable = Math.max(0, workCompletedValue - clientIncomeTotal);
  const workPaidPercent =
    workCompletedValue > 0
      ? Math.min(100, Math.round((clientIncomeTotal / workCompletedValue) * 100))
      : 0;

  const contractRemaining = Math.max(0, project.contractValue - clientIncomeTotal);
  const contractPaidPercent =
    project.contractValue > 0
      ? Math.min(
          100,
          Math.round((clientIncomeTotal / project.contractValue) * 100),
        )
      : 0;

  const isPayAtEnd = project.billingMode === "PAY_AT_END";
  const showTermin = project.billingMode === "TERMIN_PLAN";

  const fundMap = await getMandorFundSummariesFor(
    assignedMandors.map((a) => ({ projectId: id, mandorId: a.userId })),
  );
  const overspend: { mandorName: string; amount: number }[] = [];
  const fundBriefs = assignedMandors.map((a) => {
    const s = fundMap.get(`${id}::${a.userId}`);
    if (s && s.sisa < 0) {
      overspend.push({ mandorName: a.user.name, amount: -s.sisa });
    }
    return {
      mandorName: a.user.name,
      totalCair: s?.totalCair ?? 0,
      totalBukti: s?.totalBukti ?? 0,
      sisa: s?.sisa ?? 0,
    };
  });

  const mandorExpenseRows = project.transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.isMandorExpense)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      description: tx.description,
      proofUrl: tx.proofUrl,
      mandorName: tx.createdBy.name,
      pencairanLabel: tx.linkedMandorDisbursement
        ? tidyCase(tx.linkedMandorDisbursement.label)
        : tx.linkedContractorAdvance
          ? `Termin ${tidyCase(tx.linkedContractorAdvance.contractor.name)}`
          : null,
      lines: tx.expenseLines.map((l) => ({
        id: l.id,
        kind: l.kind,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        workDays: l.workDays,
        dailyRate: l.dailyRate,
        amount: l.amount,
      })),
    }));

  return (
    <div>
      <PageHeader
        title={tidyCase(project.name)}
        description={`${tidyCase(project.location)} · ${projectStatusLabels[project.status]} · ${billingModeLabels[project.billingMode]}`}
        actions={
          <>
            <Link href="/projects" className={btnSecondaryClass}>
              Kembali
            </Link>
            {admin ? (
              <Link
                href={`/transactions/new?projectId=${project.id}&type=INCOME`}
                className={btnSecondaryClass}
              >
                {isPayAtEnd ? "+ Pembayaran" : "+ Pembayaran"}
              </Link>
            ) : null}
          </>
        }
      />

      <Card className="mb-6">
        <MandorDisbursementPanel
          projectId={project.id}
          canEdit={admin}
          mandors={assignedMandors.map((a) => ({
            id: a.user.id,
            name: a.user.name,
          }))}
          sources={sources.map((s) => ({ id: s.id, name: s.name }))}
          rows={disbursements.map((d) => ({
            id: d.id,
            date: format(d.date, "dd/MM/yyyy"),
            label: d.label,
            amount: d.amount,
            mandorName: d.mandor.name,
            proofUrl: d.proofUrl,
          }))}
          overspend={overspend}
        />
      </Card>

      <Card className="mb-6">
        <MandorExpensePanel
          rows={mandorExpenseRows}
          fundBriefs={fundBriefs}
          bukuKasHref={`/transactions/project?projectId=${project.id}`}
          canBreakDown={canBreakDown}
        />
      </Card>

      {readOnlyAdmin ? (
        <Card className="mb-6">
          <p className="text-sm text-[var(--ink-muted)]">
            Mode baca Admin — untuk buku kas detail dengan bukti, buka{" "}
            <Link
              href={`/transactions/project?projectId=${project.id}`}
              className="text-[var(--accent)] underline"
            >
              Kas Proyek ini
            </Link>
            . Anda dapat memecah nota Mandor di panel di atas.
          </p>
        </Card>
      ) : null}

      <p className="mb-4 text-sm text-teal-900/65">
        {billingModeHints[project.billingMode]}
      </p>

      <ContractorPanel
        projectId={project.id}
        admin={admin}
        projectCash={projectCash}
        contractValue={project.contractValue}
        sources={sources}
        contractor={project.contractor}
      />

      {isPayAtEnd ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Nilai pekerjaan selesai"
              value={formatRupiah(workCompletedValue)}
              hint={`${project.workItems.length} catatan · tanpa kontrak & saldo awal`}
              tone="neutral"
            />
            <StatCard
              label="Sudah dibayar"
              value={formatRupiah(clientIncomeTotal)}
              hint={`${workPaidPercent}% dari pekerjaan`}
              tone="income"
            />
            <StatCard
              label="Biaya dari kas besar"
              value={formatRupiah(expenseTotal)}
              hint="Pengeluaran proyek ini diambil dari kas gabungan"
              tone="expense"
            />
            <StatCard
              label="Kas besar tersedia"
              value={formatRupiah(kasBesar.total)}
              hint={`Tunai ${formatRupiah(kasBesar.cash)} · Bank ${formatRupiah(kasBesar.bank)}`}
              tone="balance"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950/80">
            Sisa tagihan (piutang): <strong>{formatRupiah(receivable)}</strong> —
            pekerjaan selesai dikurangi pembayaran klien.
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-teal-900/10">
            <div
              className="h-full rounded-full bg-teal-700 transition-all"
              style={{ width: `${workPaidPercent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-teal-900/60">
            Progress pembayaran: {formatRupiah(clientIncomeTotal)} dari{" "}
            {formatRupiah(workCompletedValue)} pekerjaan selesai (
            {workPaidPercent}%).
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <Card>
              <h3 className="font-serif text-xl text-teal-950">
                Pekerjaan yang sudah dikerjakan
              </h3>
              <p className="mt-1 text-sm text-teal-900/60">
                Catat progress pekerjaan beserta nilainya. Pembayaran dilakukan di
                akhir berdasarkan total pekerjaan ini.
              </p>
              <div className="mt-4 space-y-3">
                {project.workItems.length === 0 ? (
                  <EmptyState message="Belum ada pekerjaan dicatat. Tambahkan progres pekerjaan di samping." />
                ) : (
                  project.workItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-teal-900/8 bg-teal-50/40 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-teal-950">
                            {item.description}
                          </p>
                          <p className="text-xs text-teal-900/55">
                            {format(item.date, "dd/MM/yyyy")}
                            {item.quantity != null
                              ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
                              : ""}
                          </p>
                          {item.notes ? (
                            <p className="mt-1 text-xs text-teal-900/50">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <p className="font-medium text-teal-900">
                          {formatRupiah(item.amount)}
                        </p>
                      </div>
                      {admin ? (
                        <form action={deleteWorkItemAction} className="mt-3">
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className={btnDangerClass}>
                            Hapus
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <h3 className="font-serif text-xl text-teal-950">
                  Catat pekerjaan
                </h3>
                <div className="mt-4">
                  <ActionForm
                    action={createWorkItemAction}
                    submitLabel="Simpan pekerjaan"
                  >
                    <input type="hidden" name="projectId" value={project.id} />
                    <Field label="Tanggal">
                      <input
                        name="date"
                        type="date"
                        className={inputClass}
                        defaultValue={format(new Date(), "yyyy-MM-dd")}
                        required
                      />
                    </Field>
                    <Field label="Uraian pekerjaan">
                      <input
                        name="description"
                        className={inputClass}
                        placeholder="Contoh: Pasang keramik 20 m2"
                        required
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Volume">
                        <input
                          name="quantity"
                          className={inputClass}
                          placeholder="20"
                        />
                      </Field>
                      <Field label="Satuan">
                        <input
                          name="unit"
                          className={inputClass}
                          placeholder="m2 / titik"
                        />
                      </Field>
                    </div>
                    <Field label="Nilai pekerjaan">
                      <RupiahInput name="amount" required placeholder="0" />
                    </Field>
                    <Field label="Catatan">
                      <textarea name="notes" className={inputClass} rows={2} />
                    </Field>
                  </ActionForm>
                </div>
              </Card>

                <Card>
                  <details>
                    <summary className="cursor-pointer text-base font-medium text-teal-950">
                      Pengaturan proyek
                    </summary>
                    <div className="mt-4">
                      <ActionForm
                        action={updateProjectAction}
                        submitLabel="Simpan"
                      >
                        <input type="hidden" name="id" value={project.id} />
                        <input type="hidden" name="name" value={project.name} />
                        <input
                          type="hidden"
                          name="location"
                          value={project.location}
                        />
                        <input
                          type="hidden"
                          name="status"
                          value={project.status}
                        />
                        <ProjectBillingFields
                          defaultBillingMode={project.billingMode}
                          defaultContractValue={project.contractValue}
                          defaultOpeningBalance={project.openingBalance}
                        />
                        <Field label="Catatan">
                          <textarea
                            name="notes"
                            className={inputClass}
                            rows={2}
                            defaultValue={project.notes ?? ""}
                          />
                        </Field>
                      </ActionForm>
                    </div>
                  </details>
                </Card>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Nilai kontrak"
              value={formatRupiah(project.contractValue)}
              tone="neutral"
            />
            <StatCard
              label="Sudah dibayar"
              value={formatRupiah(clientIncomeTotal)}
              hint={`${contractPaidPercent}% dari kontrak`}
              tone="income"
            />
            <StatCard
              label="Sisa belum terbayar"
              value={formatRupiah(contractRemaining)}
              hint={
                project.contractValue > 0
                  ? `${Math.max(0, 100 - contractPaidPercent)}% belum cair`
                  : "Isi nilai kontrak dulu"
              }
              tone="expense"
            />
            <StatCard
              label="Saldo kas proyek"
              value={formatRupiah(cashBalance)}
              hint={
                project.openingBalance > 0
                  ? `Awal ${formatRupiah(project.openingBalance)}`
                  : `Tanpa saldo awal · Tunai ${formatRupiah(kasBesar.cash)} · Bank ${formatRupiah(kasBesar.bank)}`
              }
              tone="balance"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-teal-900/8 bg-white/80 p-4">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-teal-900/55 uppercase">
                  Progress pembayaran (pengawasan)
                </p>
                <p className="mt-1 font-serif text-2xl text-teal-950">
                  {contractPaidPercent}%
                </p>
              </div>
              <p className="text-sm text-teal-900/65">
                {formatRupiah(clientIncomeTotal)} /{" "}
                {formatRupiah(project.contractValue)}
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-teal-900/10">
              <div
                className="h-full rounded-full bg-teal-700 transition-all"
                style={{ width: `${contractPaidPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-teal-900/55">
              Sisa tagihan kontrak: {formatRupiah(contractRemaining)}. Digunakan
              untuk laporan pengawasan pembayaran proyek.
            </p>
          </div>

          {showTermin ? (
            <>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-teal-900/10">
                <div
                  className="h-full rounded-full bg-teal-600/70 transition-all"
                  style={{ width: `${fundingProgressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-teal-900/60">
                Acuan rencana termin: {formatRupiah(receivedFunding)} dari{" "}
                {formatRupiah(fundingBase)} ({fundingProgressPercent}%).
              </p>
            </>
          ) : null}

          <div
            className={`mt-6 grid gap-6 ${admin ? "lg:grid-cols-[1fr_320px]" : ""}`}
          >
            {showTermin ? (
              <Card>
                <h3 className="font-serif text-xl text-teal-950">
                  Rencana termin (acuan)
                </h3>
                <p className="mt-1 text-sm text-teal-900/60">
                  Rencana saja. Nominal pembayaran tetap sesuai permintaan Anda.
                </p>
                <div className="mt-4 space-y-4">
                  {stages.length === 0 ? (
                    <EmptyState message="Belum ada rencana termin." />
                  ) : (
                    stages.map((stage) => (
                      <div
                        key={stage.id}
                        className="rounded-2xl border border-teal-900/8 bg-teal-50/40 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-teal-950">
                              {stage.sequence}. {stage.name}
                            </p>
                            <p className="text-xs text-teal-900/55">
                              Rencana {stage.percent}% ·{" "}
                              {formatRupiah(stage.plannedAmount)}
                            </p>
                          </div>
                          <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-700">
                            {fundingStatusLabels[stage.status]}
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-teal-700"
                            style={{ width: `${stage.progressPercent}%` }}
                          />
                        </div>
                        {admin ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs text-teal-700">
                              Edit / hapus
                            </summary>
                            <div className="mt-3 max-w-md space-y-3">
                              <ActionForm
                                action={updateFundingStageAction}
                                submitLabel="Update"
                              >
                                <input type="hidden" name="id" value={stage.id} />
                                <Field label="Nama">
                                  <input
                                    name="name"
                                    className={inputClass}
                                    defaultValue={stage.name}
                                    required
                                  />
                                </Field>
                                <div className="grid grid-cols-3 gap-2">
                                  <Field label="Urutan">
                                    <input
                                      name="sequence"
                                      className={inputClass}
                                      defaultValue={stage.sequence}
                                    />
                                  </Field>
                                  <Field label="%">
                                    <input
                                      name="percent"
                                      className={inputClass}
                                      defaultValue={stage.percent}
                                    />
                                  </Field>
                                  <Field label="Nominal">
                                    <input
                                      name="plannedAmount"
                                      className={inputClass}
                                      defaultValue={stage.plannedAmount}
                                    />
                                  </Field>
                                </div>
                              </ActionForm>
                              <form action={deleteFundingStageAction}>
                                <input type="hidden" name="id" value={stage.id} />
                                <button type="submit" className={btnDangerClass}>
                                  Hapus
                                </button>
                              </form>
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            ) : (
              <Card>
                <h3 className="font-serif text-xl text-teal-950">
                  Pembayaran sesuai permintaan
                </h3>
                <p className="mt-2 text-sm text-teal-900/65">
                  Catat pemasukan kapan saja sesuai permintaan kas. Progress di
                  atas mengikuti nilai kontrak untuk laporan pengawasan.
                </p>
                <div className="mt-4 grid gap-2 text-sm text-teal-900/75">
                  <div className="flex justify-between border-b border-teal-900/5 py-2">
                    <span>Sudah dibayar</span>
                    <strong>{formatRupiah(clientIncomeTotal)}</strong>
                  </div>
                  <div className="flex justify-between border-b border-teal-900/5 py-2">
                    <span>Sisa belum terbayar</span>
                    <strong className="text-rose-700">
                      {formatRupiah(contractRemaining)}
                    </strong>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>Persentase pembayaran</span>
                    <strong className="text-teal-800">
                      {contractPaidPercent}%
                    </strong>
                  </div>
                </div>
                <Link
                  href={`/transactions/new?projectId=${project.id}&type=INCOME`}
                  className={`${btnSecondaryClass} mt-4`}
                >
                  + Catat pembayaran
                </Link>
              </Card>
            )}

            {admin ? (
              <div className="space-y-6">
                {showTermin ? (
                  <Card>
                    <details>
                      <summary className="cursor-pointer list-none text-base font-medium text-teal-950">
                        Tambah tahapan termin
                        <span className="ml-2 text-sm font-normal text-teal-700">
                          Buka
                        </span>
                      </summary>
                      <div className="mt-4">
                        <ActionForm
                          action={createFundingStageAction}
                          submitLabel="Tambah tahapan"
                        >
                          <input
                            type="hidden"
                            name="projectId"
                            value={project.id}
                          />
                          <Field label="Nama tahapan">
                            <input name="name" className={inputClass} required />
                          </Field>
                          <Field label="Urutan">
                            <input
                              name="sequence"
                              className={inputClass}
                              defaultValue={stages.length + 1}
                            />
                          </Field>
                          <Field label="Persentase (%)">
                            <input name="percent" className={inputClass} />
                          </Field>
                          <Field label="Nominal rencana">
                            <input name="plannedAmount" className={inputClass} />
                          </Field>
                        </ActionForm>
                      </div>
                    </details>
                  </Card>
                ) : null}

                <Card>
                  <details>
                    <summary className="cursor-pointer text-base font-medium text-teal-950">
                      Pengaturan proyek
                    </summary>
                    <div className="mt-4">
                      <ActionForm
                        action={updateProjectAction}
                        submitLabel="Simpan"
                      >
                        <input type="hidden" name="id" value={project.id} />
                        <input type="hidden" name="name" value={project.name} />
                        <input
                          type="hidden"
                          name="location"
                          value={project.location}
                        />
                        <input type="hidden" name="status" value={project.status} />
                        <ProjectBillingFields
                          defaultBillingMode={project.billingMode}
                          defaultContractValue={project.contractValue}
                          defaultOpeningBalance={project.openingBalance}
                        />
                        <Field label="Catatan">
                          <textarea
                            name="notes"
                            className={inputClass}
                            rows={2}
                            defaultValue={project.notes ?? ""}
                          />
                        </Field>
                      </ActionForm>
                    </div>
                  </details>
                </Card>
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="mt-6 border-t border-teal-900/10 pt-2">
        <p className="mb-1 text-xs font-medium tracking-wide text-teal-900/45 uppercase">
          Lainnya (jarang dipakai)
        </p>
        <ProjectFundsPanel
          projectId={project.id}
          admin={admin}
          contractValue={project.contractValue}
          funds={project.funds}
          spentByKind={spentByKind}
        />
        <ProjectProfitPanel
          input={{
            contractValue: project.contractValue,
            billingMode: project.billingMode,
            workCompletedValue,
            clientIncome: clientIncomeTotal,
            operatingExpense,
            contractorAdvances,
            remainingPlannedFunds,
          }}
          feeTransferred={feeTransferred}
          ownerPersonalDraws={ownerPersonalDraws}
        />
        <ProjectFeeTransferPanel
          projectId={project.id}
          admin={admin}
          status={project.status}
          feeTargetProfit={feeQuota.feeTargetProfit}
          feeTransferred={feeQuota.feeTransferred}
          ownerPersonalDraws={feeQuota.ownerPersonalDraws}
          remainingFee={feeQuota.remaining}
          revenueBase={profitPreview.revenueBase}
          projectCash={projectCash}
          sources={sources}
          transfers={feeTransferRows}
        />
        <ProjectCompletionPanel
          projectId={project.id}
          admin={admin}
          status={project.status}
          projectCash={projectCash}
          checks={checklist}
          saveRemaining={saveRemaining}
          sources={sources}
        />
      </div>
    </div>
  );
}
