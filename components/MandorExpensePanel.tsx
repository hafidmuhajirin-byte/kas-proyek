import { format } from "date-fns";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import {
  MandorExpenseBreakdownForm,
  type ExpenseLineRow,
} from "@/components/MandorExpenseBreakdownForm";

export type MandorExpenseRow = {
  id: string;
  date: Date;
  amount: number;
  description: string;
  proofUrl: string | null;
  mandorName: string;
  pencairanLabel?: string | null;
  lines: ExpenseLineRow[];
};

export type MandorFundBrief = {
  mandorName: string;
  totalCair: number;
  totalBukti: number;
  sisa: number;
};

/** Daftar bukti belanja yang diunggah Mandor — tampil untuk Owner/Admin. */
export function MandorExpensePanel({
  rows,
  fundBriefs,
  bukuKasHref,
  canBreakDown = false,
}: {
  rows: MandorExpenseRow[];
  fundBriefs: MandorFundBrief[];
  bukuKasHref?: string;
  canBreakDown?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-[var(--ink)]">Bukti belanja Mandor</h3>
        <p className="text-xs text-[var(--ink-faint)]">
          Laporan pemakaian dana cair — tidak memotong Kas Besar lagi. Admin
          dapat memecah tiap nota menjadi bahan / pekerja.
        </p>
      </div>

      {fundBriefs.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {fundBriefs.map((b) => (
            <div
              key={b.mandorName}
              className="rounded-lg border border-[var(--line-soft)] bg-[var(--paper-tint)]/50 px-3 py-2 text-sm"
            >
              <p className="font-medium text-[var(--ink)]">{b.mandorName}</p>
              <p className="mt-1 tabular-nums text-[var(--ink)]/85">
                Cair {formatRupiah(b.totalCair)} · Bukti{" "}
                {formatRupiah(b.totalBukti)}
              </p>
              <p
                className={`text-xs ${
                  b.sisa < 0
                    ? "text-[var(--rose-ink)]"
                    : b.sisa > 0
                      ? "text-amber-800"
                      : "text-[var(--emerald-ink)]"
                }`}
              >
                {b.sisa > 0
                  ? `Sisa tanggungan bukti ${formatRupiah(b.sisa)}`
                  : b.sisa < 0
                    ? `Kelebihan bukti ${formatRupiah(-b.sisa)}`
                    : b.totalCair > 0
                      ? "Bukti menutup dana cair"
                      : "Belum ada pencairan"}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-y divide-[var(--line-soft)] rounded-lg border border-[var(--line)]">
          {rows.map((r) => (
            <li key={r.id} className="px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--ink)]">
                    {tidyCase(r.description)}
                  </p>
                  <p className="text-xs text-[var(--ink-faint)]">
                    {format(r.date, "dd/MM/yyyy")} · {r.mandorName}
                    {r.pencairanLabel ? ` · ${r.pencairanLabel}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums text-[var(--rose-ink)]">
                    {formatRupiah(r.amount)}
                  </span>
                  {r.proofUrl ? (
                    <a
                      href={r.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)] underline"
                    >
                      Lihat bukti
                    </a>
                  ) : (
                    <span className="text-[var(--ink-faint)]">Tanpa file</span>
                  )}
                </div>
              </div>
              <MandorExpenseBreakdownForm
                transactionId={r.id}
                proofAmount={r.amount}
                lines={r.lines}
                canEdit={canBreakDown}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--ink-faint)]">
          Belum ada upload bukti dari Mandor.
        </p>
      )}

      {bukuKasHref ? (
        <p className="text-xs text-[var(--ink-faint)]">
          Rincian di{" "}
          <a href={bukuKasHref} className="text-[var(--accent)] underline">
            Kas Proyek
          </a>{" "}
          sebagai <strong>Belanja Mandor (laporan)</strong>.
        </p>
      ) : null}
    </div>
  );
}
