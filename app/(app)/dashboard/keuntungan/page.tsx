import Link from "next/link";
import {
  PageHeader,
  StatCard,
  Card,
  EmptyState,
  btnSecondaryClass,
} from "@/components/ui";
import { formatRupiah } from "@/lib/money";
import { requireOwner } from "@/lib/auth";
import { getProjectsProfitOverview } from "@/lib/project-profit-overview";
import {
  PROJECT_FEE_PERCENT,
  PROFIT_METHOD_NOTE,
} from "@/lib/project-profit";
import { tidyCase } from "@/lib/text";

export default async function KeuntunganPage() {
  await requireOwner();
  const { totals, rows } = await getProjectsProfitOverview({ activeOnly: true });

  const costUsedTotal = rows.reduce((sum, r) => sum + r.profit.costUsed, 0);
  const remainingFundsTotal = rows.reduce(
    (sum, r) => sum + r.profit.remainingPlannedFunds,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Sistem hitung keuntungan"
        description="Rumus, pemasukan, pengeluaran, dan rincian per proyek aktif."
        actions={
          <Link href="/dashboard" className={btnSecondaryClass}>
            ← Dashboard
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pemasukan klien"
          value={formatRupiah(totals.clientIncome)}
          tone="income"
        />
        <StatCard
          label="Biaya terpakai"
          value={formatRupiah(costUsedTotal)}
          tone="expense"
        />
        <StatCard
          label="Keuntungan realisasi"
          value={formatRupiah(totals.realizedProfit)}
          tone={totals.realizedProfit >= 0 ? "income" : "expense"}
        />
        <StatCard
          label={`Target fee ${PROJECT_FEE_PERCENT}%`}
          value={formatRupiah(totals.feeTargetProfit)}
          tone="neutral"
        />
      </div>

      <Card className="mt-6">
        <h3 className="text-base font-medium text-[var(--ink)]">
          Cara menghitung
        </h3>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Ringkasan rumus yang dipakai di dashboard dan detail proyek.
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--paper-tint)]/60 px-3.5 py-3">
            <dt className="font-medium text-[var(--ink)]">
              Keuntungan realisasi
            </dt>
            <dd className="mt-1 text-[var(--ink-muted)]">
              Pemasukan klien − biaya terpakai (operasional + uang muka
              kontraktor)
            </dd>
            <dd className="mt-2 font-serif text-base tabular-nums text-[var(--ink)]">
              {formatRupiah(totals.clientIncome)} −{" "}
              {formatRupiah(costUsedTotal)} ={" "}
              <span
                className={
                  totals.realizedProfit >= 0
                    ? "text-[var(--emerald-ink)]"
                    : "text-[var(--rose-ink)]"
                }
              >
                {formatRupiah(totals.realizedProfit)}
              </span>
            </dd>
          </div>

          <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--paper-tint)]/60 px-3.5 py-3">
            <dt className="font-medium text-[var(--ink)]">
              Target fee {PROJECT_FEE_PERCENT}%
            </dt>
            <dd className="mt-1 text-[var(--ink-muted)]">
              Pendapatan acuan (nilai kontrak / acuan billing) ×{" "}
              {PROJECT_FEE_PERCENT}%
            </dd>
            <dd className="mt-2 font-serif text-base tabular-nums text-[var(--ink)]">
              {formatRupiah(totals.revenueBase)} × {PROJECT_FEE_PERCENT}% ={" "}
              {formatRupiah(totals.feeTargetProfit)}
            </dd>
          </div>

          <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--paper-tint)]/60 px-3.5 py-3">
            <dt className="font-medium text-[var(--ink)]">
              Proyeksi maksimal
            </dt>
            <dd className="mt-1 text-[var(--ink-muted)]">
              Pendapatan acuan − biaya terpakai − sisa rencana dana ops. −
              kontinjensi
            </dd>
            <dd className="mt-2 font-serif text-base tabular-nums text-[var(--ink)]">
              {formatRupiah(totals.revenueBase)} −{" "}
              {formatRupiah(costUsedTotal)} −{" "}
              {formatRupiah(remainingFundsTotal)} ≈{" "}
              {formatRupiah(totals.maxProjectedProfit)}
              <span className="ml-1 text-xs font-sans text-[var(--ink-faint)]">
                (kontinjensi 0% di ringkasan)
              </span>
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-[11px] leading-relaxed text-[var(--ink-faint)]">
          {PROFIT_METHOD_NOTE}
        </p>
      </Card>

      <Card className="mt-6">
        <h3 className="text-base font-medium text-[var(--ink)]">
          Rincian per proyek
        </h3>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Ketuk nama proyek untuk membuka detail dan panel estimasi keuntungan.
        </p>

        <div className="mt-4 space-y-0">
          {rows.length === 0 ? (
            <EmptyState message="Belum ada proyek aktif." />
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="border-b border-[var(--line-soft)] py-3.5 last:border-0 last:pb-0 first:pt-0"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${row.id}#keuntungan`}
                      className="text-sm font-medium text-[var(--ink)] hover:text-[var(--accent)] hover:underline"
                    >
                      {tidyCase(row.name)}
                    </Link>
                    <p className="mt-0.5 text-sm text-[var(--ink-faint)]">
                      {tidyCase(row.location)}
                    </p>
                  </div>
                  <p
                    className={`text-sm tabular-nums sm:shrink-0 sm:text-right ${
                      row.profit.realizedProfit >= 0
                        ? "text-[var(--emerald-ink)]"
                        : "text-[var(--rose-ink)]"
                    }`}
                  >
                    {formatRupiah(row.profit.realizedProfit)}
                  </p>
                </div>

                <dl className="mt-2.5 grid gap-1.5 text-sm text-[var(--ink-muted)] sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-[var(--ink-faint)]">Pemasukan</dt>
                    <dd className="tabular-nums text-[var(--ink)]">
                      {formatRupiah(row.profit.clientIncome)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-[var(--ink-faint)]">Biaya</dt>
                    <dd className="tabular-nums text-[var(--ink)]">
                      {formatRupiah(row.profit.costUsed)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-[var(--ink-faint)]">
                      Fee {PROJECT_FEE_PERCENT}%
                    </dt>
                    <dd className="tabular-nums text-[var(--ink)]">
                      {formatRupiah(row.profit.feeTargetProfit)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-[var(--ink-faint)]">Proyeksi max</dt>
                    <dd className="tabular-nums text-[var(--ink)]">
                      {formatRupiah(row.profit.maxProjectedProfit)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
