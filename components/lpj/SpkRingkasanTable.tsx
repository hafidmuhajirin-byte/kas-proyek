import { formatNumberId, formatRupiah } from "@/lib/money";
import type { SpkRingkasanTable } from "@/lib/lpj/smart-estimator";

function cellAmount(n: number) {
  return `Rp${formatNumberId(n)}`;
}

/**
 * Tabel ringkasan pagu SPK — gaya rekap LPJ (kelompok A/B/C + total).
 * Ditampilkan setelah Admin menyimpan pagu.
 */
export function SpkRingkasanTableView({
  table,
  projectName,
  contractValue,
}: {
  table: SpkRingkasanTable;
  projectName: string;
  contractValue: number;
}) {
  if (table.sections.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--ink-faint)]">
        Belum ada pagu &gt; 0. Isi dan simpan form di bawah.
      </p>
    );
  }

  const sectionLetters = table.sections.map((s) => s.letter).join(" + ");

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] px-4 py-3 text-center">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--ink)]">
          Ringkasan Pagu SPK
        </h2>
        <p className="mt-0.5 text-xs font-semibold uppercase text-[var(--ink)]">
          {projectName.trim().toUpperCase()}
        </p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Nilai SPK {formatRupiah(contractValue)}
        </p>
      </div>

      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--paper-tint)]/80">
            <th className="border border-[var(--line)] px-3 py-2 text-left font-semibold text-[var(--ink)]">
              Uraian Pekerjaan
            </th>
            <th className="border border-[var(--line)] px-3 py-2 text-right font-semibold text-[var(--ink)]">
              Jumlah Harga (Rp)
            </th>
            <th className="border border-[var(--line)] px-3 py-2 text-right font-semibold text-[var(--ink)]">
              Target Upah
            </th>
            <th className="border border-[var(--line)] px-3 py-2 text-right font-semibold text-[var(--ink)]">
              Target Material
            </th>
          </tr>
        </thead>
        <tbody>
          {table.sections.map((sec) =>
            sec.rows.map((row, idx) => {
              const isSub = row.kind === "subtotal";
              return (
                <tr
                  key={`${sec.letter}-${idx}-${row.label}`}
                  className={isSub ? "bg-[var(--paper-tint)]/50" : undefined}
                >
                  <td
                    className={`border border-[var(--line)] px-3 py-1.5 text-[var(--ink)] ${
                      isSub ? "font-semibold" : ""
                    }`}
                  >
                    {row.label}
                  </td>
                  <td
                    className={`border border-[var(--line)] px-3 py-1.5 text-right tabular-nums text-[var(--ink)] ${
                      isSub ? "font-semibold" : ""
                    }`}
                  >
                    {cellAmount(row.amount)}
                  </td>
                  <td className="border border-[var(--line)] px-3 py-1.5 text-right tabular-nums text-[var(--ink-muted)]">
                    {row.kind === "item" && row.laborTarget != null
                      ? cellAmount(row.laborTarget)
                      : ""}
                  </td>
                  <td className="border border-[var(--line)] px-3 py-1.5 text-right tabular-nums text-[var(--ink-muted)]">
                    {row.kind === "item" && row.materialTarget != null
                      ? cellAmount(row.materialTarget)
                      : ""}
                  </td>
                </tr>
              );
            }),
          )}

          <tr className="bg-[var(--paper-tint)]">
            <td className="border border-[var(--line)] px-3 py-2 font-bold text-[var(--ink)]">
              TOTAL PEKERJAAN {sectionLetters}
            </td>
            <td className="border border-[var(--line)] px-3 py-2 text-right font-bold tabular-nums text-[var(--ink)]">
              {cellAmount(table.total)}
            </td>
            <td className="border border-[var(--line)] px-3 py-2 text-right font-semibold tabular-nums text-[var(--ink)]">
              {cellAmount(table.totalLaborTarget)}
            </td>
            <td className="border border-[var(--line)] px-3 py-2 text-right font-semibold tabular-nums text-[var(--ink)]">
              {cellAmount(table.totalMaterialTarget)}
            </td>
          </tr>
          <tr>
            <td className="border border-[var(--line)] px-3 py-2 font-bold text-[var(--ink)]">
              DIBULATKAN
            </td>
            <td className="border border-[var(--line)] px-3 py-2 text-right font-bold tabular-nums text-[var(--ink)]">
              {cellAmount(table.rounded)}
            </td>
            <td className="border border-[var(--line)] px-3 py-2" />
            <td className="border border-[var(--line)] px-3 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
