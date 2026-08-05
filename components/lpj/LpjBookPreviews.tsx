import { format } from "date-fns";
import { formatRupiah } from "@/lib/money";
import type { BankMonthBlock } from "@/lib/buku-kas/bank";
import type { CashBookLine } from "@/lib/project-cash-book";
import type { LpjTaxRow } from "@/lib/lpj/load-lpj-books";
import type { TaxCeilingStatus } from "@/lib/lpj/tax-compliance";
import { TaxCeilingBar } from "@/components/lpj/TaxCeilingBar";

function LedgerTable({
  rows,
  empty,
}: {
  rows: CashBookLine[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-[var(--ink-muted)]">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line-soft)] text-[var(--ink-muted)]">
            <th className="py-2 pr-2">Tanggal</th>
            <th className="py-2 pr-2">Uraian</th>
            <th className="py-2 pr-2">Kategori</th>
            <th className="py-2 pr-2 text-right">Penerimaan</th>
            <th className="py-2 pr-2 text-right">Pengeluaran</th>
            <th className="py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.date.toISOString()}-${i}`}
              className="border-b border-[var(--line-soft)]/50"
            >
              <td className="whitespace-nowrap py-1.5 pr-2">
                {format(r.date, "dd/MM/yyyy")}
              </td>
              <td className="py-1.5 pr-2">{r.description || "—"}</td>
              <td className="py-1.5 pr-2 text-[var(--ink-muted)]">
                {r.category}
              </td>
              <td className="py-1.5 pr-2 text-right">
                {r.income ? formatRupiah(r.income) : ""}
              </td>
              <td className="py-1.5 pr-2 text-right">
                {r.expense ? formatRupiah(r.expense) : ""}
              </td>
              <td className="py-1.5 text-right">
                {r.skipBalance ? "—" : formatRupiah(r.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BankBookPreview({ blocks }: { blocks: BankMonthBlock[] }) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-muted)]">
        Belum ada pencairan bank. Isi dulu di menu Pencairan Bank.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {blocks.map((b) => (
        <div key={`${b.year}-${b.month}`}>
          <h4 className="mb-2 font-medium">{b.title}</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line-soft)] text-[var(--ink-muted)]">
                  <th className="py-2 pr-2">No</th>
                  <th className="py-2 pr-2">Tanggal</th>
                  <th className="py-2 pr-2">Uraian</th>
                  <th className="py-2 pr-2">Bukti</th>
                  <th className="py-2 pr-2 text-right">Debet</th>
                  <th className="py-2 pr-2 text-right">Kredit</th>
                  <th className="py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r) => (
                  <tr
                    key={r.no}
                    className="border-b border-[var(--line-soft)]/50"
                  >
                    <td className="py-1.5 pr-2">{r.no}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2">
                      {r.date ? format(r.date, "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="py-1.5 pr-2">{r.description}</td>
                    <td className="py-1.5 pr-2">{r.proofNo}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {r.debit ? formatRupiah(r.debit) : ""}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {r.credit ? formatRupiah(r.credit) : ""}
                    </td>
                    <td className="py-1.5 text-right">
                      {formatRupiah(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td colSpan={4} className="py-2">
                    JUMLAH
                  </td>
                  <td className="py-2 text-right">
                    {formatRupiah(b.totalDebit)}
                  </td>
                  <td className="py-2 text-right">
                    {formatRupiah(b.totalCredit)}
                  </td>
                  <td className="py-2 text-right">
                    {formatRupiah(b.closingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BkuPreview({ rows }: { rows: CashBookLine[] }) {
  return (
    <LedgerTable
      rows={rows}
      empty="Belum ada mutasi di Buku Kas Umum untuk proyek ini."
    />
  );
}

export function BktPreview({ rows }: { rows: CashBookLine[] }) {
  return (
    <LedgerTable
      rows={rows}
      empty="Belum ada transaksi tunai (Buku Kas Tunai) untuk proyek ini."
    />
  );
}

export function PajakPreview({
  rows,
  totals,
  ceiling,
}: {
  rows: LpjTaxRow[];
  totals: { totalTax: number; totalPpn: number; totalPph: number };
  ceiling: TaxCeilingStatus;
}) {
  const shown = rows.filter((r) => r.tax.totalTax > 0 || r.tax.overThreshold);
  return (
    <div className="space-y-4">
      <TaxCeilingBar status={ceiling} />
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[var(--ink-muted)]">PPN</p>
          <p className="font-medium">{formatRupiah(totals.totalPpn)}</p>
        </div>
        <div>
          <p className="text-[var(--ink-muted)]">PPh</p>
          <p className="font-medium">{formatRupiah(totals.totalPph)}</p>
        </div>
        <div>
          <p className="text-[var(--ink-muted)]">Total</p>
          <p className="font-medium">{formatRupiah(totals.totalTax)}</p>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">
          Belum ada baris kena pajak.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line-soft)] text-[var(--ink-muted)]">
                <th className="py-2 pr-2">Tanggal</th>
                <th className="py-2 pr-2">Uraian</th>
                <th className="py-2 pr-2 text-right">Dasar</th>
                <th className="py-2 pr-2 text-right">Pajak</th>
                <th className="py-2">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--line-soft)]/50"
                >
                  <td className="whitespace-nowrap py-1.5 pr-2">
                    {format(r.date, "dd/MM/yyyy")}
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.description || "—"}
                    {r.isMaterialAlam ? " (alam)" : ""}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {formatRupiah(r.amount)}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {formatRupiah(r.tax.totalTax)}
                  </td>
                  <td className="py-1.5 text-[var(--ink-muted)]">
                    {r.tax.label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
