import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { parseProjectLocation } from "@/lib/project-bkk-report";
import type { BankMonthBlock } from "@/lib/buku-kas/bank";
import {
  BKU_COST_TYPE_NOTES,
  formatBkuQty,
  type BkuMonthBlock,
  type BkuSideRow,
} from "@/lib/buku-kas/bku";
import { formatBktQty, type BktMonthBlock } from "@/lib/buku-kas/bkt";
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
  npwp?: string | null;
};

function formatRpPlain(n: number) {
  if (!n) return "";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Format angka BKU; negatif → (xxx). */
function formatRpBku(n: number, emptyZero = false) {
  if (!n && emptyZero) return "";
  if (!n) return "0,00";
  const abs = Math.abs(n);
  const text = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return n < 0 ? `(${text})` : text;
}

function formatBkuDate(d: Date | null) {
  if (!d) return "";
  return format(d, "d-MMM-yy", { locale: localeId });
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
  labels,
  title,
  orgName,
  name,
  nip,
}: {
  /** Baris atas (Mengetahui / Menyetujui / tanggal + Dibuat Oleh) — tinggi diseragamkan */
  labels: string[];
  title: string;
  orgName?: string | null;
  name?: string | null;
  nip?: string | null;
}) {
  const nipText = nip?.trim() || "";
  const org = orgName?.trim() || "";
  // Dua baris label: baris-1 tanggal (kanan) / kosong; baris-2 Mengetahui|Menyetujui|Dibuat Oleh
  const line1 = labels[0] ?? "";
  const line2 = labels[1] ?? "";

  return (
    <div className="flex h-full w-full flex-col text-center text-[11px] leading-snug sm:text-xs">
      <div className="mb-3 min-h-[2.75rem] space-y-1">
        <p className="min-h-[1.25rem]">{line1 || "\u00a0"}</p>
        <p className="min-h-[1.25rem]">{line2 || "\u00a0"}</p>
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 min-h-[1.25rem]">
        {org ? tidyCase(org) : "\u00a0"}
      </p>
      {/* Ruang tanda tangan — cukup untuk paraf, tidak terlalu tinggi */}
      <div className="mx-auto my-5 h-10 shrink-0 sm:my-6 sm:h-12" aria-hidden />
      <div className="mt-auto">
        <p className="font-semibold underline decoration-1 underline-offset-2">
          {name?.trim() || "(nama)"}
        </p>
        {nipText ? <p className="mt-0.5">NIP. {nipText}</p> : null}
      </div>
    </div>
  );
}

function emptySideRow(): BkuSideRow {
  return { date: null, description: "", amount: 0 };
}

function BkuEmptyCell({ className = "" }: { className?: string }) {
  return (
    <td className={`border border-stone-400 ${className}`} />
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
              Bulan{" "}
              {format(new Date(b.year, b.month - 1, 1), "MMMM yyyy", {
                locale: localeId,
              })}
            </p>

            <div className="mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 sm:text-sm">
              <div className="space-y-0.5">
                <p>
                  <span className="inline-block w-24 text-stone-600">
                    Sekolah
                  </span>
                  <span>: {school}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-stone-600">Desa</span>
                  <span>: {loc.alamat}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-stone-600">
                    Kecamatan
                  </span>
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
                    <th className="border border-stone-400 px-1.5 py-2 text-center">
                      No.
                    </th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">
                      Tanggal
                    </th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">
                      Uraian
                    </th>
                    <th className="border border-stone-400 px-1.5 py-2 text-center">
                      No. Bukti
                    </th>
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

            <div className="mt-16 grid grid-cols-1 gap-8 sm:mt-20 sm:grid-cols-3 sm:items-stretch sm:gap-3">
              <SignatoryBlock
                labels={["", "Mengetahui :"]}
                title="Kepala Sekolah"
                orgName={school}
                name={meta.kepalaNama}
                nip={meta.kepalaNip}
              />
              <SignatoryBlock
                labels={["", ""]}
                title="Ketua P2SP"
                orgName={school}
                name={meta.ketuaNama}
                nip={meta.ketuaNip}
              />
              <SignatoryBlock
                labels={[placeDate, ""]}
                title="Bendahara P2SP"
                orgName={school}
                name={meta.bendaharaNama}
                nip={meta.bendaharaNip}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** Buku Kas Umum — format resmi (pemasukan | pengeluaran). */
export function BkuPreview({
  blocks,
  meta,
  projectTitle,
  minRows = 10,
}: {
  blocks: BkuMonthBlock[];
  meta: LpjHeaderMeta;
  projectTitle?: string;
  minRows?: number;
}) {
  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const prov = meta.provinsi?.trim() || loc.propinsi;
  const school = tidyCase(meta.schoolName);
  const subtitle = tidyCase(projectTitle || meta.schoolName);

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-muted)]">
        Belum ada mutasi di Buku Kas Umum untuk proyek ini.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {blocks.map((b) => {
        const incomes = [...b.incomes];
        const expenses = [...b.expenses];
        const rowCount = Math.max(incomes.length, expenses.length, minRows);
        while (incomes.length < rowCount) incomes.push(emptySideRow());
        while (expenses.length < rowCount) expenses.push(emptySideRow());

        const dayName = format(b.periodEnd, "EEEE", { locale: localeId });
        const endLong = format(b.periodEnd, "d MMMM yyyy", {
          locale: localeId,
        });
        const placeDate = `${(loc.kecamatan !== "—" ? loc.kecamatan : kab) || "Malang"} ${endLong}`;

        return (
          <article
            key={`${b.year}-${b.month}`}
            className="break-inside-avoid rounded-lg border border-stone-300 bg-white p-4 text-black sm:p-5 print:border-0 print:p-0"
          >
            <h3 className="text-center text-base font-bold tracking-wide sm:text-lg">
              BUKU KAS UMUM
            </h3>
            <p className="mt-0.5 text-center text-xs font-semibold uppercase tracking-wide sm:text-sm">
              {subtitle}
            </p>

            <div className="mt-4 grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3 sm:text-xs">
              <div className="space-y-0.5">
                <p>
                  <span className="inline-block w-[7.5rem] text-stone-600">
                    Bulan ke
                  </span>
                  <span>: {b.monthIndex}</span>
                </p>
                <p>
                  <span className="inline-block w-[7.5rem] text-stone-600">
                    Sekolah
                  </span>
                  <span>: {school}</span>
                </p>
                <p>
                  <span className="inline-block w-[7.5rem] align-top text-stone-600">
                    Alamat
                  </span>
                  <span className="inline">: {loc.alamat}</span>
                </p>
              </div>
              <div className="space-y-0.5">
                <p>
                  <span className="inline-block w-24 text-stone-600">
                    Kecamatan
                  </span>
                  <span>: {loc.kecamatan}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-stone-600">
                    Kabupaten
                  </span>
                  <span>: {kab}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-stone-600">
                    Propinsi
                  </span>
                  <span>: {prov}</span>
                </p>
              </div>
              <div className="space-y-0.5">
                <p>
                  <span className="inline-block w-[8.5rem] text-stone-600">
                    Awal Pembukuan
                  </span>
                  <span>
                    :{" "}
                    {format(b.periodStart, "dd MMMM yyyy", {
                      locale: localeId,
                    })}
                  </span>
                </p>
                <p>
                  <span className="inline-block w-[8.5rem] text-stone-600">
                    Akhir Pembukuan
                  </span>
                  <span>
                    :{" "}
                    {format(b.periodEnd, "dd MMMM yyyy", { locale: localeId })}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="bg-stone-100">
                    <th
                      colSpan={3}
                      className="border border-stone-400 px-1 py-1.5 text-center font-semibold"
                    >
                      Pemasukan
                    </th>
                    <th
                      colSpan={8}
                      className="border border-stone-400 px-1 py-1.5 text-center font-semibold"
                    >
                      Pengeluaran
                    </th>
                  </tr>
                  <tr className="bg-stone-50">
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Tanggal
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Uraian
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Jumlah (Rp.)
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Tanggal
                    </th>
                    <th
                      colSpan={4}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Uraian
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      No. Bukti
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Jenis Biaya
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Jumlah (Rp.)
                    </th>
                  </tr>
                  <tr className="bg-stone-50">
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Status
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Qty
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Sat
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }).map((_, i) => {
                    const inc = incomes[i];
                    const exp = expenses[i];
                    const incEmpty =
                      !inc.description && !inc.amount && !inc.date;
                    const expEmpty =
                      !exp.description && !exp.amount && !exp.date;
                    return (
                      <tr key={i} className="h-7">
                        {incEmpty ? (
                          <>
                            <BkuEmptyCell className="w-[4.5rem]" />
                            <BkuEmptyCell />
                            <BkuEmptyCell className="w-[6.5rem]" />
                          </>
                        ) : (
                          <>
                            <td className="border border-stone-400 px-1 text-center whitespace-nowrap">
                              {formatBkuDate(inc.date)}
                            </td>
                            <td className="border border-stone-400 px-1">
                              {inc.description}
                            </td>
                            <td className="border border-stone-400 px-1 text-right tabular-nums">
                              {formatRpBku(inc.amount)}
                            </td>
                          </>
                        )}
                        {expEmpty ? (
                          <>
                            <BkuEmptyCell className="w-[4.5rem]" />
                            <BkuEmptyCell className="w-16" />
                            <BkuEmptyCell className="w-12" />
                            <BkuEmptyCell className="w-10" />
                            <BkuEmptyCell />
                            <BkuEmptyCell className="w-14" />
                            <BkuEmptyCell className="w-12" />
                            <BkuEmptyCell className="w-[6.5rem]" />
                          </>
                        ) : (
                          <>
                            <td className="border border-stone-400 px-1 text-center whitespace-nowrap">
                              {formatBkuDate(exp.date)}
                            </td>
                            <td className="border border-stone-400 px-1 whitespace-nowrap">
                              {exp.status || ""}
                            </td>
                            <td className="border border-stone-400 px-1 text-right tabular-nums whitespace-nowrap">
                              {formatBkuQty(exp.quantity)}
                            </td>
                            <td className="border border-stone-400 px-1 text-center whitespace-nowrap">
                              {exp.unit || ""}
                            </td>
                            <td className="border border-stone-400 px-1">
                              {exp.description}
                            </td>
                            <td className="border border-stone-400 px-1 text-center whitespace-nowrap">
                              {exp.proofNo || ""}
                            </td>
                            <td className="border border-stone-400 px-1 text-center">
                              {exp.costType || ""}
                            </td>
                            <td className="border border-stone-400 px-1 text-right tabular-nums">
                              {formatRpBku(exp.amount, true)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  <tr className="bg-stone-50 font-semibold">
                    <td
                      colSpan={2}
                      className="border border-stone-400 px-1 py-1.5"
                    >
                      Jumlah penerimaan bulan ini
                    </td>
                    <td className="border border-stone-400 px-1 text-right tabular-nums">
                      {formatRpBku(b.totalIncome)}
                    </td>
                    <td
                      colSpan={7}
                      className="border border-stone-400 px-1 py-1.5"
                    >
                      Jumlah pengeluaran bulan ini
                    </td>
                    <td className="border border-stone-400 px-1 text-right tabular-nums">
                      {b.totalExpense ? formatRpBku(b.totalExpense) : ""}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="text-[11px] leading-relaxed sm:text-xs">
                <p>
                  Buku ini ditutup pada hari {dayName} tanggal {endLong} dengan
                  posisi :
                </p>
                <p className="mt-2 font-semibold">Saldo Buku Kas Umum</p>
                <table className="mt-1 text-[11px] sm:text-xs">
                  <tbody>
                    <tr>
                      <td className="py-0.5 pr-6">Saldo Bank</td>
                      <td className="pr-2">:</td>
                      <td className="tabular-nums">
                        Rp {formatRpBku(b.bankBalance)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-6">Saldo Kas Tunai</td>
                      <td className="pr-2">:</td>
                      <td className="tabular-nums">
                        Rp {formatRpBku(b.cashBalance)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="py-0.5 pr-6">Jumlah</td>
                      <td className="pr-2">:</td>
                      <td className="tabular-nums">
                        Rp {formatRpBku(b.totalBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border border-stone-400 p-2 text-[10px] leading-snug sm:min-w-[200px] sm:text-[11px]">
                <p className="font-semibold">Catatan :</p>
                <p className="mt-1">Jenis Biaya :</p>
                <ul className="mt-0.5 space-y-0.5">
                  {BKU_COST_TYPE_NOTES.map((n) => (
                    <li key={n.code}>
                      <span className="font-semibold">{n.code}</span> :{" "}
                      {n.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:mt-20 sm:grid-cols-3 sm:items-stretch sm:gap-3">
              <SignatoryBlock
                labels={["", "Mengetahui"]}
                title="Kepala Sekolah"
                orgName={school}
                name={meta.kepalaNama}
                nip={meta.kepalaNip}
              />
              <SignatoryBlock
                labels={["", "Menyetujui"]}
                title="Ketua Tim Pelaksana"
                orgName=""
                name={meta.ketuaNama}
                nip={meta.ketuaNip}
              />
              <SignatoryBlock
                labels={[placeDate, "Dibuat Oleh"]}
                title="Bendahara Pembangunan"
                orgName=""
                name={meta.bendaharaNama}
                nip={meta.bendaharaNip}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function BktPreview({
  blocks,
  meta,
  projectTitle,
  minRows = 12,
}: {
  blocks: BktMonthBlock[];
  meta: LpjHeaderMeta;
  projectTitle?: string;
  minRows?: number;
}) {
  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const prov = meta.provinsi?.trim() || loc.propinsi;
  const school = tidyCase(meta.schoolName);
  const subtitle = tidyCase(projectTitle || meta.schoolName);

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-muted)]">
        Belum ada transaksi tunai (Buku Kas Tunai) untuk proyek ini.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {blocks.map((b) => {
        const padded = [...b.rows];
        while (padded.length < minRows) {
          padded.push({
            date: null,
            proofNo: "",
            status: "",
            quantity: null,
            unit: null,
            description: "",
            unitPrice: null,
            income: 0,
            expense: 0,
            saldoDebet: 0,
            saldoKredit: 0,
          });
        }
        const endLong = format(b.periodEnd, "d MMMM yyyy", {
          locale: localeId,
        });
        const placeDate = `${(loc.kecamatan !== "—" ? loc.kecamatan : kab) || "Malang"} ${endLong}`;

        return (
          <article
            key={`${b.year}-${b.month}`}
            className="break-inside-avoid rounded-lg border border-stone-300 bg-white p-4 text-black sm:p-5 print:border-0 print:p-0"
          >
            <h3 className="text-center text-base font-bold tracking-wide sm:text-lg">
              BUKU KAS TUNAI
            </h3>
            <p className="mt-0.5 text-center text-xs font-semibold uppercase tracking-wide sm:text-sm">
              {subtitle}
            </p>

            <div className="mt-4 grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2 sm:text-xs">
              <div className="space-y-0.5">
                <p>
                  <span className="inline-block w-[7.5rem] text-stone-600">
                    Bulan ke
                  </span>
                  <span>: {b.monthIndex}</span>
                </p>
                <p>
                  <span className="inline-block w-[7.5rem] text-stone-600">
                    Sekolah
                  </span>
                  <span>: {school}</span>
                </p>
                <p>
                  <span className="inline-block w-[7.5rem] align-top text-stone-600">
                    Alamat
                  </span>
                  <span>: {loc.alamat}</span>
                </p>
              </div>
              <div className="space-y-0.5">
                <p>
                  <span className="inline-block w-24 text-stone-600">
                    Kecamatan
                  </span>
                  <span>: {loc.kecamatan}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-stone-600">
                    Kabupaten
                  </span>
                  <span>: {kab}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-stone-600">
                    Propinsi
                  </span>
                  <span>: {prov}</span>
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="bg-stone-100">
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Tanggal
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      No. Bukti
                    </th>
                    <th
                      colSpan={5}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Uraian
                    </th>
                    <th
                      colSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Jenis Transaksi
                    </th>
                    <th
                      colSpan={2}
                      className="border border-stone-400 px-1 py-1 text-center font-medium"
                    >
                      Saldo
                    </th>
                  </tr>
                  <tr className="bg-stone-50">
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Status
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Qty
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Sat
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Keterangan
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Harga Satuan
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Penerimaan
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Pengeluaran
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Debet
                    </th>
                    <th className="border border-stone-400 px-1 py-1 text-center font-medium">
                      Kredit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {padded.map((r, i) => {
                    const empty =
                      !r.description &&
                      !r.income &&
                      !r.expense &&
                      !r.date &&
                      !r.proofNo;
                    return (
                      <tr key={i} className="h-7">
                        <td className="border border-stone-400 px-1 text-center whitespace-nowrap">
                          {r.date
                            ? format(r.date, "d-MMM-yy", { locale: localeId })
                            : ""}
                        </td>
                        <td className="border border-stone-400 px-1 text-center whitespace-nowrap">
                          {r.proofNo}
                        </td>
                        <td className="border border-stone-400 px-1 whitespace-nowrap">
                          {r.status}
                        </td>
                        <td className="border border-stone-400 px-1 text-right tabular-nums">
                          {formatBktQty(r.quantity)}
                        </td>
                        <td className="border border-stone-400 px-1 text-center">
                          {r.unit || ""}
                        </td>
                        <td className="border border-stone-400 px-1">
                          {r.description}
                        </td>
                        <td className="border border-stone-400 px-1 text-right tabular-nums whitespace-nowrap">
                          {r.unitPrice
                            ? `@ ${formatRpPlain(r.unitPrice)}`
                            : ""}
                        </td>
                        <td className="border border-stone-400 px-1 text-right tabular-nums">
                          {empty
                            ? ""
                            : r.income
                              ? formatRpBku(r.income)
                              : ""}
                        </td>
                        <td className="border border-stone-400 px-1 text-right tabular-nums">
                          {empty
                            ? ""
                            : r.expense
                              ? formatRpBku(r.expense)
                              : ""}
                        </td>
                        <td className="border border-stone-400 px-1 text-right tabular-nums">
                          {empty
                            ? ""
                            : r.saldoDebet
                              ? formatRpBku(r.saldoDebet)
                              : r.description || r.income || r.expense
                                ? "-"
                                : ""}
                        </td>
                        <td className="border border-stone-400 px-1 text-right tabular-nums">
                          {empty
                            ? ""
                            : r.saldoKredit
                              ? formatRpBku(r.saldoKredit)
                              : ""}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-stone-50 font-semibold">
                    <td
                      colSpan={7}
                      className="border border-stone-400 px-1 py-1.5 text-center"
                    >
                      JUMLAH
                    </td>
                    <td className="border border-stone-400 px-1 text-right tabular-nums">
                      {formatRpBku(b.totalIncome)}
                    </td>
                    <td className="border border-stone-400 px-1 text-right tabular-nums">
                      {formatRpBku(b.totalExpense)}
                    </td>
                    <td
                      colSpan={2}
                      className="border border-stone-400 px-1 text-right tabular-nums"
                    >
                      {formatRpBku(Math.abs(b.closingBalance))}
                      {b.closingBalance < 0 ? " (K)" : ""}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 sm:mt-20 sm:grid-cols-3 sm:items-stretch sm:gap-3">
              <SignatoryBlock
                labels={["", "Mengetahui"]}
                title="Kepala Sekolah"
                orgName={school}
                name={meta.kepalaNama}
                nip={meta.kepalaNip}
              />
              <SignatoryBlock
                labels={["", "Menyetujui"]}
                title="Ketua Tim Pelaksana"
                orgName=""
                name={meta.ketuaNama}
                nip={meta.ketuaNip}
              />
              <SignatoryBlock
                labels={[placeDate, "Dibuat Oleh"]}
                title="Bendahara Pembangunan"
                orgName=""
                name={meta.bendaharaNama}
                nip={meta.bendaharaNip}
              />
            </div>
          </article>
        );
      })}
    </div>
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
