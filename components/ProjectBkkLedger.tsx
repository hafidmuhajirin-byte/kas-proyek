import { format } from "date-fns";
import { formatRupiah } from "@/lib/money";
import {
  buildBkkRunningBalance,
  formatQty,
  formatUnitPrice,
  parseProjectLocation,
  sumBkkCash,
  type BkkReportRow,
} from "@/lib/project-bkk-report";
import { tidyCase } from "@/lib/text";

function cell(amount: number, empty = "—") {
  if (amount <= 0) return empty;
  return formatRupiah(amount);
}

export function ProjectBkkLedger({
  projectName,
  location,
  rows,
  opening = 0,
  bulanKe,
}: {
  projectName: string;
  location: string;
  rows: BkkReportRow[];
  opening?: number;
  bulanKe?: number | null;
}) {
  const book = buildBkkRunningBalance(rows, opening);
  const totals = sumBkkCash(rows);
  const loc = parseProjectLocation(location);
  const last = book.length > 0 ? book[book.length - 1] : null;
  const akhir = last ? last.saldoDebet - last.saldoKredit : opening;

  return (
    <div className="text-sm">
      <div className="mb-3 grid gap-1 border border-teal-900/15 bg-[#f3f7f5] px-3 py-2.5 text-xs sm:grid-cols-2">
        <p>
          <span className="text-teal-900/55">Bulan ke:</span>{" "}
          <strong className="text-teal-950">{bulanKe ?? "—"}</strong>
        </p>
        <p>
          <span className="text-teal-900/55">Sekolah:</span>{" "}
          <strong className="text-teal-950">{tidyCase(projectName)}</strong>
        </p>
        <p className="sm:col-span-2">
          <span className="text-teal-900/55">Alamat / lokasi:</span>{" "}
          <strong className="text-teal-950">{tidyCase(loc.alamat)}</strong>
        </p>
        <p>
          <span className="text-teal-900/55">Kecamatan:</span>{" "}
          {tidyCase(loc.kecamatan)}
        </p>
        <p>
          <span className="text-teal-900/55">Kabupaten:</span>{" "}
          {tidyCase(loc.kabupaten)}
        </p>
        <p>
          <span className="text-teal-900/55">Propinsi:</span>{" "}
          {tidyCase(loc.propinsi)}
        </p>
      </div>

      {book.length === 0 && opening <= 0 ? (
        <p className="px-1 text-teal-900/55">
          Belum ada mutasi kas pada proyek ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse text-left text-[11px] sm:text-xs">
            <thead>
              <tr className="bg-teal-800 text-white">
                <th
                  className="border border-teal-900/20 px-1.5 py-2 font-medium"
                  rowSpan={2}
                >
                  Tanggal
                </th>
                <th
                  className="border border-teal-900/20 px-1.5 py-2 font-medium"
                  rowSpan={2}
                >
                  No. Bukti
                </th>
                <th
                  className="border border-teal-900/20 px-1.5 py-1 text-center font-medium"
                  colSpan={5}
                >
                  Uraian
                </th>
                <th
                  className="border border-teal-900/20 px-1.5 py-1 text-center font-medium"
                  colSpan={2}
                >
                  Jenis Transaksi
                </th>
                <th
                  className="border border-teal-900/20 px-1.5 py-1 text-center font-medium"
                  colSpan={2}
                >
                  Saldo
                </th>
              </tr>
              <tr className="bg-teal-700 text-white">
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Status
                </th>
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Qty
                </th>
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Sat
                </th>
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Keterangan
                </th>
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Harga Satuan
                </th>
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Penerimaan
                </th>
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Pengeluaran
                </th>
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Debet
                </th>
                <th className="border border-teal-900/20 px-1 py-1.5 font-medium">
                  Kredit
                </th>
              </tr>
            </thead>
            <tbody>
              {opening > 0 ? (
                <tr className="bg-teal-50/60">
                  <td className="border border-teal-900/10 px-1.5 py-1.5 text-teal-900/50">
                    —
                  </td>
                  <td className="border border-teal-900/10 px-1.5 py-1.5 text-teal-900/50">
                    —
                  </td>
                  <td className="border border-teal-900/10 px-1 py-1.5">—</td>
                  <td className="border border-teal-900/10 px-1 py-1.5">—</td>
                  <td className="border border-teal-900/10 px-1 py-1.5">—</td>
                  <td className="border border-teal-900/10 px-1 py-1.5">
                    Saldo awal
                  </td>
                  <td className="border border-teal-900/10 px-1 py-1.5">—</td>
                  <td className="border border-teal-900/10 px-1.5 py-1.5 text-right tabular-nums text-emerald-800">
                    {cell(opening)}
                  </td>
                  <td className="border border-teal-900/10 px-1.5 py-1.5 text-center text-teal-900/40">
                    —
                  </td>
                  <td className="border border-teal-900/10 px-1.5 py-1.5 text-right tabular-nums">
                    {formatRupiah(opening)}
                  </td>
                  <td className="border border-teal-900/10 px-1.5 py-1.5 text-center text-teal-900/40">
                    —
                  </td>
                </tr>
              ) : null}

              {book.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.skipBalance
                      ? "bg-amber-50/40"
                      : "odd:bg-white even:bg-teal-50/20"
                  }
                >
                  <td className="border border-teal-900/10 px-1.5 py-1.5 whitespace-nowrap">
                    {format(row.date, "dd/MM/yyyy")}
                  </td>
                  <td className="border border-teal-900/10 px-1.5 py-1.5 whitespace-nowrap font-medium">
                    {row.buktiNo}
                  </td>
                  <td className="border border-teal-900/10 px-1 py-1.5">
                    {row.status}
                  </td>
                  <td className="border border-teal-900/10 px-1 py-1.5 text-right tabular-nums">
                    {formatQty(row.quantity)}
                  </td>
                  <td className="border border-teal-900/10 px-1 py-1.5">
                    {row.unit ?? "—"}
                  </td>
                  <td className="max-w-[14rem] border border-teal-900/10 px-1 py-1.5">
                    {tidyCase(row.keterangan)}
                    {row.skipBalance ? (
                      <span className="ml-1 text-[10px] text-amber-800">*</span>
                    ) : null}
                  </td>
                  <td className="border border-teal-900/10 px-1 py-1.5 whitespace-nowrap tabular-nums">
                    {formatUnitPrice(row.unitPrice)}
                  </td>
                  <td className="border border-teal-900/10 px-1.5 py-1.5 text-right whitespace-nowrap tabular-nums text-emerald-800">
                    {cell(row.penerimaan)}
                  </td>
                  <td className="border border-teal-900/10 px-1.5 py-1.5 text-right whitespace-nowrap tabular-nums text-rose-800">
                    {cell(row.pengeluaran)}
                  </td>
                  <td
                    className={`border border-teal-900/10 px-1.5 py-1.5 text-right whitespace-nowrap tabular-nums ${
                      row.saldoDebet > 0 ? "text-teal-950" : "text-teal-900/40"
                    }`}
                  >
                    {row.saldoDebet > 0 ? formatRupiah(row.saldoDebet) : "—"}
                  </td>
                  <td
                    className={`border border-teal-900/10 px-1.5 py-1.5 text-right whitespace-nowrap tabular-nums ${
                      row.saldoKredit > 0 ? "text-rose-700" : "text-teal-900/40"
                    }`}
                  >
                    {row.saldoKredit > 0 ? formatRupiah(row.saldoKredit) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-teal-800/10 font-medium">
                <td
                  colSpan={7}
                  className="border border-teal-900/10 px-1.5 py-2 text-right"
                >
                  Jumlah · * = rincian bukti Mandor (tidak potong kas lagi)
                </td>
                <td className="border border-teal-900/10 px-1.5 py-2 text-right tabular-nums text-emerald-800">
                  {cell(totals.penerimaan + (opening > 0 ? opening : 0))}
                </td>
                <td className="border border-teal-900/10 px-1.5 py-2 text-right tabular-nums text-rose-800">
                  {cell(totals.pengeluaran)}
                </td>
                <td className="border border-teal-900/10 px-1.5 py-2 text-right tabular-nums">
                  {akhir >= 0 ? formatRupiah(akhir) : "—"}
                </td>
                <td className="border border-teal-900/10 px-1.5 py-2 text-right tabular-nums text-rose-700">
                  {akhir < 0 ? formatRupiah(-akhir) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
