import Link from "next/link";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";

type CashSlice = {
  label: string;
  value: number;
  color: string;
};

type ProfitBar = {
  id: string;
  name: string;
  value: number;
};

export function DashboardCharts({
  cash,
  bank,
  profitBars,
  onTrackContractTotal = 0,
  onTrackPaidTotal = 0,
  onTrackRemaining = 0,
  onTrackCount = 0,
  variant = "full",
}: {
  cash: number;
  bank: number;
  profitBars: ProfitBar[];
  onTrackContractTotal?: number;
  onTrackPaidTotal?: number;
  onTrackRemaining?: number;
  onTrackCount?: number;
  /** Admin: hanya ringkasan pelaksanaan on track */
  variant?: "full" | "onTrackOnly";
}) {
  const slices: CashSlice[] = [
    { label: "Tunai", value: Math.max(0, cash), color: "var(--accent)" },
    { label: "Bank", value: Math.max(0, bank), color: "#5a8f86" },
  ];
  const cashTotal = slices.reduce((sum, s) => sum + s.value, 0);
  const maxProfit = Math.max(
    1,
    ...profitBars.map((b) => Math.abs(b.value)),
  );
  const paidPercent =
    onTrackContractTotal > 0
      ? Math.min(
          100,
          Math.round((onTrackPaidTotal / onTrackContractTotal) * 100),
        )
      : 0;

  const onTrackBlock = (
        <div className="space-y-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--paper-tint)]/70 px-3 py-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Total kontrak on track
              </p>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                {onTrackCount > 0
                  ? `${onTrackCount} proyek on track`
                  : "Belum ada proyek on track"}
              </p>
            </div>
            <p className="shrink-0 font-serif text-lg tabular-nums leading-none text-[var(--accent)] sm:text-xl">
              {formatRupiah(onTrackContractTotal)}
            </p>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-2 border-t border-[var(--line-soft)] pt-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Dana terpakai (termin)
              </p>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                Pembayaran klien · {paidPercent}%
              </p>
            </div>
            <p className="shrink-0 font-serif text-lg tabular-nums leading-none text-[var(--ink)] sm:text-xl">
              {formatRupiah(onTrackPaidTotal)}
            </p>
          </div>

          <div className="h-1.5 overflow-hidden rounded bg-white/70">
            <div
              className="h-full rounded bg-[var(--accent)]"
              style={{ width: `${paidPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-2 border-t border-[var(--line-soft)] pt-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Sisa dana
              </p>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                Kontrak − termin
              </p>
            </div>
            <p className="shrink-0 font-serif text-lg tabular-nums leading-none text-[var(--accent)] sm:text-xl">
              {formatRupiah(onTrackRemaining)}
            </p>
          </div>
        </div>
  );

  if (variant === "onTrackOnly") {
    return (
      <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="text-sm font-medium text-[var(--ink)]">
          Pelaksanaan on track
        </h3>
        <p className="mt-0.5 text-sm text-[var(--ink-faint)]">
          Ringkasan kontrak proyek yang berjalan sesuai jadwal
        </p>
        <div className="mt-4">{onTrackBlock}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="text-sm font-medium text-[var(--ink)]">Kas besar</h3>
        <p className="mt-0.5 text-sm text-[var(--ink-faint)]">
          Komposisi Tunai vs Bank
        </p>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
          <CashDonut slices={slices} total={cashTotal} />
          <ul className="w-full min-w-0 flex-1 space-y-2 text-sm">
            {slices.map((slice) => {
              const pct =
                cashTotal > 0
                  ? Math.round((slice.value / cashTotal) * 100)
                  : 0;
              return (
                <li
                  key={slice.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: slice.color }}
                      aria-hidden
                    />
                    <span className="truncate text-[var(--ink)]/85">
                      {slice.label}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--ink)]">
                    {formatRupiah(slice.value)}
                    <span className="ml-1.5 text-[var(--ink-faint)]">
                      {pct}%
                    </span>
                  </span>
                </li>
              );
            })}
            <li className="flex items-center justify-between border-t border-[var(--line-soft)] pt-2 font-medium text-[var(--ink)]">
              <span>Total</span>
              <span className="tabular-nums">{formatRupiah(cash + bank)}</span>
            </li>
          </ul>
        </div>

        <div className="mt-4">{onTrackBlock}</div>
      </div>

      <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-[var(--ink)]">
              Keuntungan per proyek
            </h3>
            <p className="mt-0.5 text-sm text-[var(--ink-faint)]">
              Realisasi proyek aktif · ketuk nama untuk detail
            </p>
          </div>
          <Link
            href="/dashboard/keuntungan"
            className="shrink-0 text-sm text-[var(--accent)] hover:underline"
          >
            Sistem hitung
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {profitBars.length === 0 ? (
            <p className="text-sm text-[var(--ink-faint)]">
              Belum ada proyek aktif.
            </p>
          ) : (
            profitBars.map((bar) => {
              const width = Math.max(
                2,
                Math.round((Math.abs(bar.value) / maxProfit) * 100),
              );
              const positive = bar.value >= 0;
              return (
                <div key={bar.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <Link
                      href={`/projects/${bar.id}`}
                      className="min-w-0 truncate font-medium text-[var(--ink)] hover:text-[var(--accent)] hover:underline"
                    >
                      {tidyCase(bar.name)}
                    </Link>
                    <Link
                      href={`/projects/${bar.id}#keuntungan`}
                      className={`shrink-0 tabular-nums hover:underline ${
                        positive
                          ? "text-[var(--emerald-ink)]"
                          : "text-[var(--rose-ink)]"
                      }`}
                      title="Lihat rincian perhitungan"
                    >
                      {formatRupiah(bar.value)}
                    </Link>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-[var(--paper-tint)]">
                    <div
                      className={`h-full rounded ${
                        positive ? "bg-[var(--accent)]" : "bg-[var(--rose-ink)]"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CashDonut({
  slices,
  total,
}: {
  slices: CashSlice[];
  total: number;
}) {
  const size = 112;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (total <= 0) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line-soft)"
          strokeWidth={stroke}
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden
    >
      {slices.map((slice) => {
        if (slice.value <= 0) return null;
        const length = (slice.value / total) * circumference;
        const dashoffset = -offset;
        offset += length;
        return (
          <circle
            key={slice.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={stroke}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashoffset}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
}
