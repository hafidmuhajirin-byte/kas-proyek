"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/money";
import {
  calcProjectProfit,
  PROFIT_MARGIN_BENCHMARK,
  PROJECT_FEE_PERCENT,
  PROFIT_METHOD_NOTE,
  type ProjectProfitInput,
} from "@/lib/project-profit";
import { Card } from "@/components/ui";

export function ProjectProfitPanel({
  input,
  feeTransferred = 0,
  ownerPersonalDraws = 0,
}: {
  input: Omit<ProjectProfitInput, "contingencyPercent">;
  feeTransferred?: number;
  ownerPersonalDraws?: number;
}) {
  const [contingencyPercent, setContingencyPercent] = useState(0);
  const [open, setOpen] = useState(false);
  const profit = calcProjectProfit({ ...input, contingencyPercent });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#keuntungan") {
      setOpen(true);
      document.getElementById("keuntungan")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  const marginTone =
    profit.marginBand === "within"
      ? "text-[var(--accent)]"
      : profit.marginBand === "above"
        ? "text-[var(--emerald-ink)]"
        : profit.marginBand === "below"
          ? "text-[var(--rose-ink)]"
          : "text-[var(--ink-faint)]";

  const marginHint =
    profit.marginBand === "within"
      ? `Sekitar estimasi ${PROJECT_FEE_PERCENT}% (${PROFIT_MARGIN_BENCHMARK.low}–${PROFIT_MARGIN_BENCHMARK.high}%)`
      : profit.marginBand === "above"
        ? `Di atas estimasi ${PROJECT_FEE_PERCENT}%`
        : profit.marginBand === "below"
          ? `Di bawah estimasi ${PROJECT_FEE_PERCENT}%`
          : "Belum ada acuan kontrak";

  return (
    <Card id="keuntungan" className="mt-2 scroll-mt-24">
      <details
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">
                Estimasi keuntungan
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                {formatRupiah(profit.feeTargetProfit)} · realisasi{" "}
                {formatRupiah(profit.realizedProfit)}
              </p>
            </div>
            <span className="text-xs text-[var(--accent)]">
              {open ? "Tutup" : "Buka"}
            </span>
          </div>
        </summary>

        <div className="mt-4 border-t border-[var(--line-soft)] pt-4">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--line-soft)] bg-[#fffcf7] p-3.5">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Estimasi {PROJECT_FEE_PERCENT}%
              </p>
              <p className="mt-1.5 font-serif text-xl tabular-nums text-[var(--ink)] sm:text-2xl">
                {formatRupiah(profit.feeTargetProfit)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
                (Kontrak − ops) × {PROJECT_FEE_PERCENT}%
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line-soft)] bg-[#fffcf7] p-3.5">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Realisasi saat ini
              </p>
              <p
                className={`mt-1.5 font-serif text-xl tabular-nums sm:text-2xl ${
                  profit.realizedProfit >= 0
                    ? "text-[var(--ink)]"
                    : "text-[var(--rose-ink)]"
                }`}
              >
                {formatRupiah(profit.realizedProfit)}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--paper-tint)]/80 p-3.5">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Proyeksi maksimal
              </p>
              <p
                className={`mt-1.5 font-serif text-xl tabular-nums sm:text-2xl ${
                  profit.maxProjectedProfit >= 0
                    ? "text-[var(--ink)]"
                    : "text-[var(--rose-ink)]"
                }`}
              >
                {formatRupiah(profit.maxProjectedProfit)}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line-soft)] bg-[#fffcf7] p-3.5">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Margin proyeksi
              </p>
              <p
                className={`mt-1.5 font-serif text-xl tabular-nums sm:text-2xl ${marginTone}`}
              >
                {profit.projectedMarginPercent != null
                  ? `${profit.projectedMarginPercent}%`
                  : "—"}
              </p>
              <p className={`mt-1 text-xs ${marginTone}`}>{marginHint}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-teal-900/8 bg-teal-50/40 px-4 py-3 text-sm text-teal-950/80">
            Sisa potensi:{" "}
            <strong className="tabular-nums">
              {formatRupiah(profit.remainingPotential)}
            </strong>
            {profit.feeTargetProfit > 0 ? (
              <>
                {" "}
                · Gap ke estimasi:{" "}
                <strong className="tabular-nums">
                  {formatRupiah(profit.feeTargetProfit - profit.realizedProfit)}
                </strong>
              </>
            ) : null}
            {feeTransferred > 0 ? (
              <>
                {" "}
                · Fee ke bank:{" "}
                <strong className="tabular-nums">
                  {formatRupiah(feeTransferred)}
                </strong>
              </>
            ) : null}
            {ownerPersonalDraws > 0 ? (
              <>
                {" "}
                · Ambil pribadi:{" "}
                <strong className="tabular-nums">
                  {formatRupiah(ownerPersonalDraws)}
                </strong>
              </>
            ) : null}
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="contingency" className="font-medium text-teal-950">
                Kontinjensi risiko
              </label>
              <span className="tabular-nums text-teal-900/70">
                {contingencyPercent}% · {formatRupiah(profit.contingencyAmount)}
              </span>
            </div>
            <input
              id="contingency"
              type="range"
              min={0}
              max={15}
              step={1}
              value={contingencyPercent}
              onChange={(e) => setContingencyPercent(Number(e.target.value))}
              className="w-full accent-teal-800"
            />
          </div>

          <dl className="mt-5 grid gap-2 border-t border-teal-900/10 pt-4 text-sm text-teal-900/75 sm:grid-cols-2">
            <div className="flex justify-between gap-3 border-b border-teal-900/5 py-1.5">
              <dt>Nilai kontrak</dt>
              <dd className="tabular-nums font-medium text-teal-950">
                {formatRupiah(input.contractValue)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-teal-900/5 py-1.5">
              <dt>Dana operasional</dt>
              <dd className="tabular-nums font-medium text-rose-800">
                {formatRupiah(profit.operationalFunds)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-teal-900/5 py-1.5">
              <dt>Dasar estimasi</dt>
              <dd className="tabular-nums font-medium text-teal-950">
                {formatRupiah(profit.feeBase)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-teal-900/5 py-1.5">
              <dt>Pendapatan diterima</dt>
              <dd className="tabular-nums font-medium text-teal-950">
                {formatRupiah(profit.clientIncome)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-teal-900/5 py-1.5">
              <dt>Biaya terpakai</dt>
              <dd className="tabular-nums font-medium text-rose-800">
                {formatRupiah(profit.costUsed)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-teal-900/5 py-1.5">
              <dt>Sisa rencana dana ops.</dt>
              <dd className="tabular-nums font-medium text-rose-800">
                {formatRupiah(profit.remainingPlannedFunds)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-[11px] leading-relaxed text-teal-900/45">
            {PROFIT_METHOD_NOTE}
          </p>
        </div>
      </details>
    </Card>
  );
}
