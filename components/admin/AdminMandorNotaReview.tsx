"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { TAX_THRESHOLD } from "@/lib/lpj/tax-compliance";
import {
  MandorExpenseBreakdownForm,
  type BreakdownStatus,
  type ExpenseLineRow,
  type KnownWorkerOption,
} from "@/components/MandorExpenseBreakdownForm";
import { ProofReviewLink } from "@/components/ProofReviewLink";
import {
  MandorNotaSplitButton,
  MandorNotaUndoSplitButton,
} from "@/components/admin/MandorNotaSplitButton";
import { Card } from "@/components/ui";

export type AdminNotaBkk = {
  id: string;
  splitIndex: number | null;
  amount: number;
  description: string;
  vendor: string | null;
  breakdownStatus: BreakdownStatus;
  breakdownNote: string | null;
  laborPeriodStart: Date | string | null;
  laborPeriodEnd: Date | string | null;
  laborWeekIndex: number | null;
  lines: ExpenseLineRow[];
};

export type AdminNotaGroup = {
  parentId: string;
  date: Date | string;
  mandorTotal: number;
  description: string;
  proofUrl: string | null;
  mandorName: string;
  isAdminLpjNota?: boolean;
  isSplit: boolean;
  parentStatus: BreakdownStatus;
  parentNote: string | null;
  /** Sebelum split: satu BKK = parent. Setelah split: anak-anak saja. */
  bkks: AdminNotaBkk[];
  taxLabel: string;
  taxAmount: number;
  overThreshold: boolean;
};

function statusLabel(status: BreakdownStatus) {
  if (status === "APPROVED")
    return { text: "APPROVED", className: "text-emerald-700" };
  if (status === "REJECTED")
    return { text: "REJECTED", className: "text-rose-700" };
  return { text: "PENDING", className: "text-[var(--ink-faint)]" };
}

function pecahHint(bkk: AdminNotaBkk) {
  if (bkk.breakdownStatus === "APPROVED") return "Lihat pecahan";
  if (bkk.lines.length > 0) return "Lanjut pecah";
  return "Pecah nota";
}

/**
 * Review nota Mandor untuk Admin — pecah isi = UI Owner,
 * plus Split Nota opsional per BKK.
 */
export function AdminMandorNotaReview({
  groups,
  knownWorkers = [],
  projectId,
}: {
  groups: AdminNotaGroup[];
  knownWorkers?: KnownWorkerOption[];
  projectId: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-muted)]">
        Belum ada nota Mandor untuk proyek ini.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {groups.map((g) => {
        const date = typeof g.date === "string" ? new Date(g.date) : g.date;
        const st = statusLabel(g.parentStatus);
        const lockedOthers = (exceptId: string) =>
          g.bkks
            .filter((b) => b.id !== exceptId)
            .reduce((s, b) => s + b.amount, 0);

        return (
          <li key={g.parentId}>
            <Card className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--ink)]">
                    {tidyCase(g.description) || "Tanpa uraian"}
                    {g.isAdminLpjNota ? (
                      <span className="ml-2 inline-block rounded border border-[var(--line)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--ink-muted)]">
                        Admin LPJ
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {format(date, "dd/MM/yyyy")} ·{" "}
                    {g.isAdminLpjNota ? "Admin" : `Mandor ${g.mandorName}`} ·
                    Total {formatRupiah(g.mandorTotal)} · Status:{" "}
                    <span className={st.className}>{st.text}</span>
                    {g.isSplit ? " · di-split" : ""}
                  </p>
                  {g.parentStatus === "REJECTED" && g.parentNote ? (
                    <p className="mt-1 text-xs text-rose-800">
                      Alasan tolak: {g.parentNote}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-sm">
                  <p className="text-[var(--ink-muted)]">{g.taxLabel}</p>
                  <p className="font-medium">
                    Pajak {formatRupiah(g.taxAmount)}
                  </p>
                  {g.overThreshold ? (
                    <p className="mt-1 text-xs text-amber-800">
                      Nota &gt; {formatRupiah(TAX_THRESHOLD)} — pecah isi dulu;
                      Split Nota opsional untuk BKK berikutnya
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--ink-faint)]">
                      Di bawah ambang {formatRupiah(TAX_THRESHOLD)}
                    </p>
                  )}
                  {g.proofUrl ? (
                    <ProofReviewLink
                      href={g.proofUrl}
                      title={tidyCase(g.description)}
                      className="mt-1 inline-block text-xs text-[var(--accent)] underline"
                    >
                      Lihat bukti
                    </ProofReviewLink>
                  ) : null}
                  {g.isSplit ? (
                    <div className="mt-2">
                      <MandorNotaUndoSplitButton parentId={g.parentId} />
                    </div>
                  ) : null}
                </div>
              </div>

              <ul className="divide-y divide-[var(--line-soft)] rounded-lg border border-[var(--line)]">
                {g.bkks.map((bkk) => {
                  const open = openId === bkk.id;
                  const bkkSt = statusLabel(bkk.breakdownStatus);
                  const label =
                    g.isSplit && bkk.splitIndex
                      ? `BKK.${bkk.splitIndex}`
                      : "Nota / BKK";
                  const lineSum = bkk.lines.reduce((s, l) => s + l.amount, 0);
                  const remainingAfterCurrent =
                    g.mandorTotal - lockedOthers(bkk.id) - lineSum;

                  return (
                    <li key={bkk.id} className="px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-[var(--ink)]">
                            {label}
                            {g.isSplit ? ` · ${formatRupiah(bkk.amount)}` : ""}
                            <span
                              className={`ml-1.5 text-[11px] font-normal ${bkkSt.className}`}
                            >
                              {bkkSt.text}
                            </span>
                          </p>
                          <p className="truncate text-[11px] text-[var(--ink-faint)]">
                            {tidyCase(bkk.description)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5 text-xs">
                          <span className="tabular-nums text-[var(--rose-ink)]">
                            {formatRupiah(bkk.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : bkk.id)}
                            className="rounded border border-[var(--line)] px-2 py-0.5 text-[var(--ink)] hover:bg-[var(--paper-tint)]"
                          >
                            {open ? "Tutup" : pecahHint(bkk)}
                          </button>
                        </div>
                      </div>

                      {open ? (
                        <MandorExpenseBreakdownForm
                          transactionId={bkk.id}
                          projectId={projectId}
                          proofAmount={bkk.amount}
                          lines={bkk.lines}
                          canEdit
                          vendor={bkk.vendor}
                          status={bkk.breakdownStatus}
                          rejectNote={bkk.breakdownNote}
                          knownWorkers={knownWorkers}
                          laborPeriodStart={bkk.laborPeriodStart}
                          laborPeriodEnd={bkk.laborPeriodEnd}
                          laborWeekIndex={bkk.laborWeekIndex}
                          afterActions={
                            bkk.breakdownStatus !== "APPROVED" ? (
                              <MandorNotaSplitButton
                                transactionId={bkk.id}
                                mandorTotal={g.mandorTotal}
                                lineCount={bkk.lines.length}
                                remainingAfterCurrent={remainingAfterCurrent}
                                partCount={g.isSplit ? g.bkks.length : 1}
                              />
                            ) : null
                          }
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
