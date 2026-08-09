"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import {
  MandorExpenseBreakdownForm,
  type BreakdownStatus,
  type ExpenseLineRow,
  type KnownWorkerOption,
} from "@/components/MandorExpenseBreakdownForm";
import { ProofReviewLink } from "@/components/ProofReviewLink";

export type MandorExpenseRow = {
  id: string;
  date: Date | string;
  amount: number;
  description: string;
  proofUrl: string | null;
  mandorName: string;
  pencairanLabel?: string | null;
  vendor?: string | null;
  breakdownStatus?: BreakdownStatus;
  breakdownNote?: string | null;
  laborPeriodStart?: Date | string | null;
  laborPeriodEnd?: Date | string | null;
  laborWeekIndex?: number | null;
  lines: ExpenseLineRow[];
};

export type MandorFundBrief = {
  mandorName: string;
  totalCair: number;
  totalBukti: number;
  sisa: number;
};

function statusLabel(status?: BreakdownStatus) {
  if (status === "APPROVED") return { text: "✓", className: "text-emerald-700" };
  if (status === "REJECTED") return { text: "ditolak", className: "text-rose-700" };
  return null;
}

function pecahHint(row: MandorExpenseRow) {
  if (row.breakdownStatus === "APPROVED") return "Lihat pecahan";
  if (row.lines.length > 0) return "Lanjut pecah";
  return "Pecah nota";
}

/** Daftar bukti belanja Mandor — ringkas; pecahan hanya saat dibuka. */
export function MandorExpensePanel({
  rows,
  fundBriefs,
  bukuKasHref,
  canBreakDown = false,
  knownWorkers = [],
}: {
  rows: MandorExpenseRow[];
  fundBriefs: MandorFundBrief[];
  bukuKasHref?: string;
  canBreakDown?: boolean;
  knownWorkers?: KnownWorkerOption[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [fundsOpen, setFundsOpen] = useState(false);
  const totalBukti = rows.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-medium text-[var(--ink)]">Bukti belanja Mandor</h3>
        <p className="text-sm tabular-nums text-[var(--ink)]">
          <span className="text-[var(--ink-muted)]">Total </span>
          <span className="font-semibold text-[var(--rose-ink)]">
            {formatRupiah(totalBukti)}
          </span>
          {rows.length > 0 ? (
            <span className="ml-1.5 text-xs text-[var(--ink-faint)]">
              · {rows.length} nota
            </span>
          ) : null}
        </p>
      </div>

      {fundBriefs.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setFundsOpen((v) => !v)}
            className="text-xs text-[var(--accent)] underline"
          >
            {fundsOpen ? "Sembunyikan dana" : "Ringkasan dana"}
          </button>
          {fundsOpen ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {fundBriefs.map((b) => (
                <div
                  key={b.mandorName}
                  className="rounded-lg border border-[var(--line-soft)] bg-[var(--paper-tint)]/50 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-[var(--ink)]">{b.mandorName}</p>
                  <p className="mt-1 tabular-nums text-[var(--ink)]/85">
                    Cair {formatRupiah(b.totalCair)} · Bukti{" "}
                    {formatRupiah(b.totalBukti)}
                    {b.sisa !== 0
                      ? ` · ${b.sisa > 0 ? "Sisa" : "Lebih"} ${formatRupiah(Math.abs(b.sisa))}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-y divide-[var(--line-soft)] rounded-lg border border-[var(--line)]">
          {rows.map((r) => {
            const open = openId === r.id;
            const st = statusLabel(r.breakdownStatus);
            const date =
              typeof r.date === "string" ? new Date(r.date) : r.date;
            return (
              <li key={r.id} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--ink)]">
                      {tidyCase(r.description)}
                      {st ? (
                        <span
                          className={`ml-1.5 text-[11px] font-normal ${st.className}`}
                        >
                          {st.text}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-[var(--ink-faint)]">
                      {format(date, "dd/MM/yyyy")} · {r.mandorName}
                      {r.pencairanLabel ? ` · ${r.pencairanLabel}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5 text-xs">
                    <span className="tabular-nums text-[var(--rose-ink)]">
                      {formatRupiah(r.amount)}
                    </span>
                    {r.proofUrl ? (
                      <ProofReviewLink
                        href={r.proofUrl}
                        title={tidyCase(r.description)}
                        className="text-[var(--accent)] underline"
                      >
                        Bukti
                      </ProofReviewLink>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : r.id)}
                      className="rounded border border-[var(--line)] px-2 py-0.5 text-[var(--ink)] hover:bg-[var(--paper-tint)]"
                    >
                      {open ? "Tutup" : pecahHint(r)}
                    </button>
                  </div>
                </div>

                {open ? (
                  <MandorExpenseBreakdownForm
                    transactionId={r.id}
                    proofAmount={r.amount}
                    lines={r.lines}
                    canEdit={canBreakDown}
                    vendor={r.vendor}
                    status={r.breakdownStatus ?? "PENDING"}
                    rejectNote={r.breakdownNote}
                    knownWorkers={knownWorkers}
                    laborPeriodStart={r.laborPeriodStart}
                    laborPeriodEnd={r.laborPeriodEnd}
                    laborWeekIndex={r.laborWeekIndex}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {bukuKasHref ? (
        <a
          href={bukuKasHref}
          className="inline-block text-xs text-[var(--accent)] underline"
        >
          Kas Proyek
        </a>
      ) : null}
    </div>
  );
}
