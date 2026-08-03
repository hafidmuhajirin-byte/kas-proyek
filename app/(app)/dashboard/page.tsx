import Link from "next/link";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Alert,
  PageHeader,
  StatCard,
  EmptyState,
  btnSecondaryClass,
  Card,
} from "@/components/ui";
import { DashboardCharts } from "@/components/DashboardCharts";
import { ProjectSchedule } from "@/components/ProjectSchedule";
import {
  getPeriodSummary,
  getGlobalCashBreakdown,
} from "@/lib/balance";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getProjectsProfitOverview } from "@/lib/project-profit-overview";
import { PROJECT_FEE_PERCENT } from "@/lib/project-profit";
import {
  buildProjectSchedule,
  filterScheduleItems,
} from "@/lib/project-schedule";
import { tidyCase } from "@/lib/text";
import { isAdmin, isOwner, requireSession } from "@/lib/auth";
import { getOverspendAlarms } from "@/lib/mandor-fund";

export default async function DashboardPage() {
  const user = await requireSession();
  const owner = isOwner(user);
  const adminView = isAdmin(user);
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [period, recent, kasBesar, profitOverview, activeProjects, overspendAlarms] =
    await Promise.all([
      owner
        ? getPeriodSummary(monthStart, monthEnd)
        : Promise.resolve({
            projectExpense: 0,
            income: 0,
            expense: 0,
            ownerPersonalExpense: 0,
            ownerPersonalInjection: 0,
            contractorAdvances: 0,
            feeTransferExpense: 0,
            cashAffectingExpense: 0,
            net: 0,
          }),
      owner
        ? prisma.transaction.findMany({
            take: 5,
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            where: { isOwnerPersonal: false },
            select: {
              id: true,
              date: true,
              type: true,
              amount: true,
              description: true,
              project: { select: { name: true } },
              cashSource: { select: { name: true } },
              fundingStage: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      owner
        ? getGlobalCashBreakdown()
        : Promise.resolve({ cash: 0, bank: 0, total: 0 }),
      getProjectsProfitOverview({ activeOnly: true }),
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          location: true,
          contractValue: true,
          createdAt: true,
        },
      }),
      owner ? getOverspendAlarms() : Promise.resolve([]),
    ]);

  const kasBesarHabis = owner && kasBesar.total <= 0;
  const { totals: profitTotals, rows: profitRows } = profitOverview;

  const allSchedule = activeProjects.map((p) => buildProjectSchedule(p, now));
  const scheduleItems = filterScheduleItems(allSchedule, { view: "on_track" });
  const onTrackSchedule = allSchedule.filter(
    (item) => item.status === "on_track",
  );
  const onTrackIds = new Set(onTrackSchedule.map((item) => item.id));
  const onTrackContractTotal = onTrackSchedule.reduce(
    (sum, item) => sum + item.contractValue,
    0,
  );
  const profitById = new Map(profitRows.map((r) => [r.id, r]));
  const onTrackPaidTotal = [...onTrackIds].reduce(
    (sum, id) => sum + (profitById.get(id)?.profit.clientIncome ?? 0),
    0,
  );
  const onTrackRemaining = Math.max(0, onTrackContractTotal - onTrackPaidTotal);
  const visibleIds = new Set(scheduleItems.map((item) => item.id));
  const profitBars = profitRows
    .filter((row) => visibleIds.has(row.id))
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      name: row.name,
      value: row.profit.realizedProfit,
    }));

  // —— Admin: hanya pelaksanaan on track ——
  if (adminView) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Pengawasan pelaksanaan proyek on track."
        />
        <div className="mt-2">
          <DashboardCharts
            cash={0}
            bank={0}
            profitBars={[]}
            onTrackContractTotal={onTrackContractTotal}
            onTrackPaidTotal={onTrackPaidTotal}
            onTrackRemaining={onTrackRemaining}
            onTrackCount={onTrackSchedule.length}
            variant="onTrackOnly"
          />
        </div>
        <div className="mt-6">
          <ProjectSchedule
            items={scheduleItems}
            totalCount={allSchedule.length}
            focusLabel="on track"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Kas, fee, dan jadwal proyek."
        actions={
          owner ? (
            <Link href="/transactions/new" className={btnSecondaryClass}>
              + Transaksi
            </Link>
          ) : undefined
        }
      />

      {overspendAlarms.length > 0 ? (
        <Card className="mb-4 border-rose-300 bg-rose-50">
          <p className="mb-2 font-medium text-rose-950">
            Alarm: bukti Mandor melebihi dana cair — segera berikan dana
            berikutnya
          </p>
          <ul className="space-y-1 text-sm text-rose-900">
            {overspendAlarms.map((a) => (
              <li key={`${a.projectId}-${a.mandorId}`}>
                <Link
                  href={`/projects/${a.projectId}`}
                  className="underline"
                >
                  {tidyCase(a.projectName)}
                </Link>
                {" · "}
                {a.mandorName}: kelebihan {formatRupiah(a.overspend)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {kasBesarHabis ? (
        <div className="mb-4">
          <Alert>
            Kas besar {kasBesar.total < 0 ? "minus" : "habis"} (
            {formatRupiah(kasBesar.total)}). Wajib{" "}
            <Link
              href="/transactions/new?type=INCOME"
              className="font-medium underline"
            >
              setor dana pribadi
            </Link>{" "}
            sebelum pengeluaran baru.
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Kas besar"
          value={formatRupiah(kasBesar.total)}
          tone="balance"
        />
        <StatCard
          label={`Target fee ${PROJECT_FEE_PERCENT}%`}
          value={formatRupiah(profitTotals.feeTargetProfit)}
          tone="neutral"
        />
        <StatCard
          label="Keuntungan realisasi"
          value={formatRupiah(profitTotals.realizedProfit)}
          tone={profitTotals.realizedProfit >= 0 ? "income" : "expense"}
          href="/dashboard/keuntungan"
          hint="Ketuk untuk sistem hitung"
        />
        <StatCard
          label="Biaya bulan ini"
          value={formatRupiah(period.projectExpense)}
          tone="expense"
        />
      </div>

      <div className="mt-6">
        <DashboardCharts
          cash={kasBesar.cash}
          bank={kasBesar.bank}
          profitBars={profitBars}
          onTrackContractTotal={onTrackContractTotal}
          onTrackPaidTotal={onTrackPaidTotal}
          onTrackRemaining={onTrackRemaining}
          onTrackCount={onTrackSchedule.length}
        />
      </div>

      <div className="mt-6">
        <ProjectSchedule
          items={scheduleItems}
          totalCount={allSchedule.length}
          focusLabel="on track"
        />
      </div>

      <div className="mt-6 rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="text-sm font-medium text-[var(--ink)]">
          Transaksi terbaru
        </h3>
        <div className="mt-4 space-y-3">
          {recent.length === 0 ? (
            <EmptyState message="Belum ada transaksi." />
          ) : (
            recent.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col gap-1 border-b border-[var(--line-soft)] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--ink)]">
                    {tidyCase(tx.description)}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--ink-faint)]">
                    {format(tx.date, "dd/MM/yyyy")} ·{" "}
                    {tx.project
                      ? tidyCase(tx.project.name)
                      : "Tanpa proyek"}{" "}
                    · {tidyCase(tx.cashSource.name)}
                    {tx.fundingStage
                      ? ` · ${tidyCase(tx.fundingStage.name)}`
                      : ""}
                  </p>
                </div>
                <p
                  className={`text-sm tabular-nums sm:shrink-0 sm:text-right ${
                    tx.type === "INCOME"
                      ? "text-[var(--emerald-ink)]"
                      : "text-[var(--rose-ink)]"
                  }`}
                >
                  {tx.type === "INCOME" ? "+" : "-"}
                  {formatRupiah(tx.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
