import { formatNumberId, formatRupiah } from "@/lib/money";
import {
  CONTRACTOR_TARGET_PERCENT,
  type MandorWorkEstimate,
} from "@/lib/contractor";

function rp(n: number) {
  return `Rp${formatNumberId(n)}`;
}

/**
 * Detail perhitungan estimasi borongan Mandor (setelah pagu manajemen SPK terisi).
 */
export function MandorBoronganCalcTable({
  estimate,
}: {
  estimate: MandorWorkEstimate;
}) {
  if (!estimate.manajemenComplete) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[var(--line)] px-3 py-3 text-xs text-[var(--ink-muted)]">
        Detail perhitungan belum tersedia. Admin harus mengisi pagu{" "}
        <strong>Bayar Jasa Perencanaan</strong>,{" "}
        <strong>Bayar jasa Pengawasan</strong>, dan{" "}
        <strong>Pengelolaan</strong> di Ringkasan SPK terlebih dahulu.
      </div>
    );
  }

  if (estimate.source !== "spk70" || estimate.amount <= 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[var(--line)] px-3 py-3 text-xs text-[var(--ink-muted)]">
        Dasar perhitungan tidak valid (nilai kontrak setelah dikurangi manajemen
        harus &gt; 0).
      </div>
    );
  }

  const rows: Array<{ label: string; amount: number; strong?: boolean }> = [
    { label: "Nilai kontrak (SPK)", amount: estimate.contractValue },
    { label: "Bayar Jasa Perencanaan", amount: -estimate.perencanaan },
    { label: "Bayar jasa Pengawasan", amount: -estimate.pengawasan },
    { label: "Dana pengelolaan", amount: -estimate.pengelolaan },
    {
      label: "Dasar (kontrak − manajemen)",
      amount: estimate.baseAmount,
      strong: true,
    },
    {
      label: `× ${CONTRACTOR_TARGET_PERCENT}%`,
      amount: Math.round(estimate.rawAmount),
    },
    {
      label: "Estimasi borongan (ROUNDDOWN −3)",
      amount: estimate.amount,
      strong: true,
    },
  ];

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--line)]">
      <table className="w-full min-w-[20rem] border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--paper-tint)]/80">
            <th className="border border-[var(--line)] px-3 py-1.5 text-left font-semibold text-[var(--ink)]">
              Uraian perhitungan
            </th>
            <th className="border border-[var(--line)] px-3 py-1.5 text-right font-semibold text-[var(--ink)]">
              Jumlah (Rp)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className={r.strong ? "bg-[var(--paper-tint)]/40" : undefined}
            >
              <td
                className={`border border-[var(--line)] px-3 py-1.5 text-[var(--ink)] ${
                  r.strong ? "font-semibold" : ""
                }`}
              >
                {r.label}
              </td>
              <td
                className={`border border-[var(--line)] px-3 py-1.5 text-right tabular-nums text-[var(--ink)] ${
                  r.strong ? "font-semibold" : ""
                }`}
              >
                {r.amount < 0 ? `−${rp(Math.abs(r.amount))}` : rp(r.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] text-[var(--ink-faint)]">
        Estimasi Mandor: {formatRupiah(estimate.amount)} · informasi saja, bukan
        dana cair
      </p>
    </div>
  );
}
