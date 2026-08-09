import type { TaxCeilingStatus } from "@/lib/lpj/tax-compliance";
import { formatRupiah } from "@/lib/money";

export function TaxCeilingBar({ status }: { status: TaxCeilingStatus }) {
  const width = Math.min(100, status.percentOfCeiling);
  const barColor =
    status.status === "over"
      ? "bg-rose-600"
      : status.status === "warn"
        ? "bg-amber-500"
        : "bg-emerald-600";

  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-[var(--ink)]">
          Plafon pajak 3,5% nilai SPK
        </h3>
        <p className="text-sm text-[var(--ink-muted)]">
          {formatRupiah(status.totalTax)} / {formatRupiah(status.ceiling)}
        </p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--paper-tint)]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${width}%` }}
          role="progressbar"
          aria-valuenow={Math.round(status.percentOfCeiling)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="mt-2 text-sm text-[var(--ink-muted)]">
        SPK {formatRupiah(status.spkValue)} · Sisa plafon{" "}
        {formatRupiah(status.remaining)} ·{" "}
        {status.status === "over"
          ? "Melebihi plafon monitoring"
          : status.status === "warn"
            ? "Mendekati plafon (≥80%)"
            : "Dalam plafon"}
      </p>
    </div>
  );
}
