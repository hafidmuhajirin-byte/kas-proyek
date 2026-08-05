import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { parseProjectLocation } from "@/lib/project-bkk-report";
import type { BankMonthBlock } from "@/lib/buku-kas/bank";
import type { CashBookLine } from "@/lib/project-cash-book";
import type { LpjTaxRow } from "@/lib/lpj/load-lpj-books";
import type { TaxCeilingStatus } from "@/lib/lpj/tax-compliance";
import { TaxCeilingBar } from "@/components/lpj/TaxCeilingBar";

export type LpjHeaderMeta = {
  schoolName: string;
  location: string;
  kabKota?: string | null;
  provinsi?: string | null;
  kepalaNama?: string | null;
  kepalaNip?: string | null;
  ketuaNama?: string | null;
  ketuaNip?: string | null;
  bendaharaNama?: string | null;
  bendaharaNip?: string | null;
};

function formatRpPlain(n: number) {
  if (!n) return "";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

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

function SignatoryBlock({
  title,
  orgName,
  name,
  nip,
}: {
  title: string;
  orgName: string;
  name?: string | null;
  nip?: string | null;
}) {
  return (
    <div className="w-full text-center text-[11px] leading-snug sm:text-xs">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5">{tidyCase(orgName)}</p>
      <div className="mx-auto my-10 h-12 sm:my-12" aria-hidden />
      <p className="font-semibold underline decoration-1 underline-offset-2">
        {name?.trim() || "(nama)"}
      </p>
      {nip?.trim() ? (
        <p className="mt-0.5">NIP. {nip.trim()}</p>
      ) : (
        <p className="mt-0.5">&nbsp;</p>
      )}
    </div>
  );
}

/** Blok Buku Bank mirip template Excel A4. */
export function BankBookPreview({
  blocks,
  meta,
  minRows = 9,
}: {
  blocks: BankMonthBlock[];
  meta: LpjHeaderMeta;
  minRows?: number;
}) {
  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const prov = meta.provinsi?.trim() || loc.propinsi;
  const school = tidyCase(meta.schoolName);

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-muted)]">
        Belum ada pencairan bank. Isi dulu di menu Pencairan Bank.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {blocks.map((b) => {
        const padded = [...b.rows];
        while (padded.length < minRows) {
          padded.push({
            no: padded.length + 1,
            date: null,
            description: "",
            proofNo: "",
            debit: 0,
            credit: 0,
            balance: 0,
          });
        }
        const monthEnd = new Date(b.year, b.month, 0);
        const placeDate = `${kab || "Malang"}, ${format(monthEnd, "d MMMM yyyy", { locale: localeId })}`;

        return (
          <article
            key={`${b.year}-${b.month}`}
            className="break-inside-avoid rounded-lg border border-stone-300 bg-white p-4 text-black sm:p-5 print:border-0 print:p-0"
          >
            <h3 className="text-center text-base font-bold tracking-wide sm:text-lg">
              BUKU BANK
            </h3>
            <p className="mt-0.5 text-center text-sm font-medium">
              Bulan {format(new Date(b.year, b.month - 1, 1), "MMMM yyyy", { locale: localeId })}
            </p>

            <div className="mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 sm:text-sm">
              <div className="space-y-0.5">
                <p>
                  <span className="inline-block w-24 text-stone-600">Sekolah</span>
                  <span>: {school}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-stone-600">Desa</span>
                  <span>: {loc.alamat}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-stone-600">Kecamatan</span>
                  <span>: {loc.kecamatan}</span>
                </p>
              </div>
              <div className="space-y-0.5 sm:text-right">
                <p>
                  <span className="text-stone-600">Kab/Kota : </span>
                  {kab}
                </p>
                <p>
                  <span className="text-stone-600">Provinsi : </span>
                  {prov}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className="bg-stone-100">
                    <th className="border border-stone-400 px-1.5 py-2 text-center">No.</th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">Tanggal</th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">Uraian</th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">No. Bukti</th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">
                      Debet / Penerimaan (Rp.)
                    </th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">
                      Kredit / Pengeluaran (Rp.)
                    </th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">
                      Saldo (Rp.)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {padded.map((r) => {
                    const empty =
                      !r.description && !r.debit && !r.credit && !r.date;
                    return (
                      <tr key={r.no} className="h-7">
                        <td className="border border-stone-400 px-1.5 text-center">
                          {r.no}
                        </td>
                        <td className="border border-stone-400 px-1.5 text-center whitespace-nowrap">
                          {r.date ? format(r.date, "dd/MM/yyyy") : ""}
                        </td>
                        <td className="border border-stone-400 px-1.5">
                          {r.description}
                        </td>
                        <td className="border border-stone-400 px-1.5 text-center">
                          {r.proofNo}
                        </td>
                        <td className="border border-stone-400 px-1.5 text-right tabular-nums">
                          {empty ? "" : r.debit ? formatRpPlain(r.debit) : ""}
                        </td>
                        <td className="border border-stone-400 px-1.5 text-right tabular-nums">
                          {empty ? "" : r.credit ? formatRpPlain(r.credit) : ""}
                        </td>
                        <td className="border border-stone-400 px-1.5 text-right tabular-nums">
                          {empty && !r.balance
                            ? ""
                            : r.description || r.debit || r.credit
                              ? formatRpPlain(r.balance)
                              : ""}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-stone-50 font-semibold">
                    <td
                      colSpan={4}
                      className="border border-stone-400 px-1.5 py-1.5 text-center"
                    >
                      JUMLAH
                    </td>
                    <td className="border border-stone-400 px-1.5 text-right tabular-nums">
                      {formatRpPlain(b.totalDebit)}
                    </td>
                    <td className="border border-stone-400 px-1.5 text-right tabular-nums">
                      {b.totalCredit ? formatRpPlain(b.totalCredit) : "-"}
                    </td>
                    <td className="border border-stone-400 px-1.5 text-right tabular-nums">
                      {formatRpPlain(b.closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:items-start sm:gap-3">
              <div className="text-center">
                <p className="mb-3 min-h-[1.25rem] text-[11px] sm:text-xs">
                  Mengetahui :
                </p>
                <SignatoryBlock
                  title="Kepala Sekolah"
                  orgName={school}
                  name={meta.kepalaNama}
                  nip={meta.kepalaNip}
                />
              </div>
              <div className="text-center">
                {/* Spacer sama tinggi label kiri/kanan agar jabatan sejajar ke bawah */}
                <p className="mb-3 min-h-[1.25rem] text-[11px] sm:text-xs">
                  &nbsp;
                </p>
                <SignatoryBlock
                  title="Ketua P2SP"
                  orgName={school}
                  name={meta.ketuaNama}
                  nip={meta.ketuaNip}
                />
              </div>
              <div className="text-center">
                <p className="mb-3 min-h-[1.25rem] text-[11px] sm:text-xs">
                  {placeDate}
                </p>
                <SignatoryBlock
                  title="Bendahara P2SP"
                  orgName={school}
                  name={meta.bendaharaNama}
                  nip={meta.bendaharaNip}
                />
              </div>
            </div>
          </article>
        );
      })}
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
