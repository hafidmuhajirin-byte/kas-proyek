"use client";

import { format } from "date-fns";
import { createFeeTransferAction } from "@/lib/actions/fee-transfers";
import { formatRupiah } from "@/lib/money";
import { PROJECT_FEE_PERCENT } from "@/lib/project-profit";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import { RupiahInput } from "@/components/RupiahInput";
import { Card } from "@/components/ui";

type SourceOption = { id: string; name: string };
type FeeTx = {
  id: string;
  date: Date;
  amount: number;
  description: string;
  cashSourceName: string;
  proofUrl: string | null;
};

export function ProjectFeeTransferPanel({
  projectId,
  admin,
  status,
  feeTargetProfit,
  feeTransferred,
  ownerPersonalDraws = 0,
  remainingFee,
  revenueBase,
  projectCash,
  sources,
  transfers,
}: {
  projectId: string;
  admin: boolean;
  status: "ACTIVE" | "COMPLETED";
  feeTargetProfit: number;
  feeTransferred: number;
  ownerPersonalDraws?: number;
  remainingFee: number;
  revenueBase: number;
  projectCash: number;
  sources: SourceOption[];
  transfers: FeeTx[];
}) {
  const active = status === "ACTIVE";
  const canTransfer =
    admin && active && remainingFee > 0 && projectCash > 0 && sources.length > 0;

  return (
    <Card className="mt-2">
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-[var(--ink)]">
                Transfer fee
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                Sisa {formatRupiah(remainingFee)}
                {feeTransferred > 0
                  ? ` · transfer ${formatRupiah(feeTransferred)}`
                  : ""}
              </p>
            </div>
            <span className="text-xs text-[var(--accent)]">Buka</span>
          </div>
        </summary>

        <div className="mt-2 border-t border-[var(--line-soft)] pt-2">
          <p className="text-xs text-[var(--ink-faint)]">
            Estimasi (kontrak − ops) × {PROJECT_FEE_PERCENT}%.
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--line-soft)] bg-[#fffcf7] px-3 py-3">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Estimasi {PROJECT_FEE_PERCENT}%
              </p>
              <p className="mt-1 font-serif text-lg tabular-nums text-[var(--ink)]">
                {formatRupiah(feeTargetProfit)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
                dari {formatRupiah(revenueBase)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line-soft)] bg-[#fffcf7] px-3 py-3">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Ambil pribadi
              </p>
              <p className="mt-1 font-serif text-lg tabular-nums text-[var(--rose-ink)]">
                {formatRupiah(ownerPersonalDraws)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line-soft)] bg-[#fffcf7] px-3 py-3">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Transfer fee
              </p>
              <p className="mt-1 font-serif text-lg tabular-nums text-[var(--ink)]">
                {formatRupiah(feeTransferred)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line-soft)] bg-[#fffcf7] px-3 py-3">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[var(--ink-faint)] uppercase">
                Sisa kuota fee
              </p>
              <p className="mt-1 font-serif text-lg tabular-nums text-[var(--accent)]">
                {formatRupiah(remainingFee)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
                Kas proyek {formatRupiah(projectCash)}
              </p>
            </div>
          </div>

          {canTransfer ? (
            <div className="mt-4 max-w-xl">
              <ActionForm
                action={createFeeTransferAction}
                submitLabel="Transfer fee"
              >
                <input type="hidden" name="projectId" value={projectId} />
                <Field label="Tanggal">
                  <input
                    name="date"
                    type="date"
                    className={inputClass}
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </Field>
                <Field label="Dari sumber kas (proyek)">
                  <select name="cashSourceId" className={inputClass} required>
                    <option value="">Pilih sumber</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ke bank pribadi / rekening lain">
                  <input
                    name="destinationBank"
                    className={inputClass}
                    placeholder="Contoh: BCA 1234567890 a.n. Owner"
                    required
                  />
                </Field>
                <Field label="Nominal (≤ sisa kuota)">
                  <RupiahInput
                    name="amount"
                    required
                    placeholder="Rp Ketik nominal, contoh 1000000"
                  />
                </Field>
                <Field label="Catatan (opsional)">
                  <input
                    name="notes"
                    className={inputClass}
                    placeholder="Termin fee ke-1"
                  />
                </Field>
                <Field label="Bukti transfer (opsional)">
                  <input
                    name="proof"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className={inputClass}
                  />
                </Field>
                <p className="text-xs text-[var(--ink-faint)]">
                  Maksimal transfer sekarang:{" "}
                  {formatRupiah(Math.min(remainingFee, projectCash))}. Dana
                  keluar dari kas proyek (bukan kas pribadi di pembukuan).
                </p>
              </ActionForm>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--ink-faint)]">
              {!active
                ? "Proyek sudah selesai — transfer fee tidak lagi dibuka."
                : !admin
                  ? "Hanya admin yang dapat transfer fee."
                  : remainingFee <= 0
                    ? "Kuota fee sudah habis."
                    : projectCash <= 0
                      ? "Kas proyek kosong — tidak ada dana untuk ditransfer."
                      : "Belum ada sumber kas."}
            </p>
          )}

          <div className="mt-5">
            <h4 className="text-sm font-medium text-[var(--ink)]">
              Riwayat transfer fee
            </h4>
            <div className="mt-2 space-y-2">
              {transfers.length === 0 ? (
                <p className="text-sm text-[var(--ink-faint)]">
                  Belum ada transfer fee.
                </p>
              ) : (
                transfers.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-start justify-between gap-3 border-b border-[var(--line-soft)] pb-2 text-sm last:border-0"
                  >
                    <div>
                      <p className="text-[var(--ink)]">{tx.description}</p>
                      <p className="text-[var(--ink-faint)]">
                        {format(tx.date, "dd/MM/yyyy")} · {tx.cashSourceName}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums text-[var(--rose-ink)]">
                      {formatRupiah(tx.amount)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </details>
    </Card>
  );
}
