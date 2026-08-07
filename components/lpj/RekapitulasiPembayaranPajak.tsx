import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { tidyCase } from "@/lib/text";
import { parseProjectLocation } from "@/lib/project-bkk-report";
import type { TaxRekapResult } from "@/lib/lpj/build-tax-rekap";
import type { LpjHeaderMeta } from "@/components/lpj/LpjBookPreviews";

function formatRp(n: number) {
  if (!n) return "";
  return n.toLocaleString("id-ID");
}

function SignCol({
  labels,
  title,
  org,
  name,
  nip,
}: {
  labels: string[];
  title: string;
  org?: string | null;
  name?: string | null;
  nip?: string | null;
}) {
  return (
    <div className="flex flex-col text-center text-[10px] leading-snug sm:text-xs">
      <div className="mb-2 min-h-[2.5rem] space-y-0.5">
        <p className="min-h-[1rem]">{labels[0] || "\u00a0"}</p>
        <p className="min-h-[1rem]">{labels[1] || "\u00a0"}</p>
      </div>
      <p className="font-medium">{title}</p>
      {org ? <p className="mt-0.5">{tidyCase(org)}</p> : null}
      <div className="min-h-[2rem]" />
      <p className="font-medium underline decoration-1">
        {name?.trim() ? tidyCase(name) : "................................"}
      </p>
      <p className="mt-0.5">
        {nip?.trim() ? `NIP. ${nip.trim()}` : "NIP. ........................"}
      </p>
    </div>
  );
}

/**
 * REKAPITULASI PEMBAYARAN PAJAK — cetak A4 (landscape disarankan).
 * Subtitle = catatan proyek. Angka dihitung dari nota; keterangan bisa diedit di halaman.
 */
export function RekapitulasiPembayaranPajak({
  rekap,
  meta,
  projectTitle,
}: {
  rekap: TaxRekapResult;
  meta: LpjHeaderMeta;
  projectTitle: string;
}) {
  const school = tidyCase(meta.schoolName);
  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const kec = loc.kecamatan;
  const prov = meta.provinsi?.trim() || loc.propinsi;
  const placeDate = `${tidyCase(kab)}, ${format(new Date(), "d MMMM yyyy", {
    locale: localeId,
  })}`;
  const t = rekap.totals;

  return (
    <article className="rekap-pajak-doc bg-white text-black">
      <header className="mb-3 text-center">
        <h1 className="text-sm font-bold uppercase underline decoration-1 sm:text-base">
          Rekapitulasi Pembayaran Pajak
        </h1>
        <p className="mt-1 text-xs font-bold uppercase sm:text-sm">
          {tidyCase(projectTitle) || school}
        </p>
      </header>

      <div className="mb-3 grid grid-cols-1 gap-x-6 gap-y-0.5 text-[11px] sm:grid-cols-2">
        <p>
          <span className="inline-block w-24">Sekolah</span>
          <span>: {school}</span>
        </p>
        <p>
          <span className="inline-block w-24">Kabupaten</span>
          <span>: {tidyCase(kab)}</span>
        </p>
        <p>
          <span className="inline-block w-24">Alamat</span>
          <span>: {tidyCase(loc.alamat)}</span>
        </p>
        <p>
          <span className="inline-block w-24">Propinsi</span>
          <span>: {tidyCase(prov)}</span>
        </p>
        <p>
          <span className="inline-block w-24">Kecamatan</span>
          <span>: {tidyCase(kec)}</span>
        </p>
        <p>
          <span className="inline-block w-24">NPWP</span>
          <span>: {meta.npwp?.trim() || ""}</span>
        </p>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse border border-black text-[9px] leading-tight">
          <thead>
            <tr className="bg-[#c9a84c] text-center font-semibold">
              <th rowSpan={2} className="border border-black px-0.5 py-1 w-6">
                No
              </th>
              <th rowSpan={2} className="border border-black px-1 py-1 min-w-[6.5rem]">
                BULAN
              </th>
              <th colSpan={2} className="border border-black px-1 py-1">
                PPN 11%
              </th>
              <th colSpan={2} className="border border-black px-1 py-1">
                PPH PASAL 22
              </th>
              <th colSpan={2} className="border border-black px-1 py-1">
                PPH PASAL 4 ayat 2
              </th>
              <th rowSpan={2} className="border border-black px-1 py-1 min-w-[5rem]">
                KETERANGAN
              </th>
            </tr>
            <tr className="bg-[#c9a84c] text-center font-semibold">
              <th className="border border-black px-0.5 py-1">
                Pajak
                <br />
                Masukan
              </th>
              <th className="border border-black px-0.5 py-1">
                Pajak
                <br />
                Pengeluaran
              </th>
              <th className="border border-black px-0.5 py-1">
                Pajak
                <br />
                Masukan
              </th>
              <th className="border border-black px-0.5 py-1">
                Pajak
                <br />
                Pengeluaran
              </th>
              <th className="border border-black px-0.5 py-1">
                Pajak
                <br />
                Masukan
              </th>
              <th className="border border-black px-0.5 py-1">
                Pajak
                <br />
                Pengeluaran
              </th>
            </tr>
          </thead>
          <tbody>
            {rekap.months.map((row) => (
              <tr key={row.month} className="align-top">
                <td className="border border-black px-0.5 py-1 text-center">
                  {row.month}
                </td>
                <td className="border border-black px-1 py-1 whitespace-nowrap">
                  {row.label}
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {formatRp(row.ppnMasukan)}
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {formatRp(row.ppnPengeluaran)}
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {formatRp(row.pph22Masukan)}
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {formatRp(row.pph22Pengeluaran)}
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {formatRp(row.pphFinalMasukan)}
                </td>
                <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                  {formatRp(row.pphFinalPengeluaran)}
                </td>
                <td className="border border-black px-1 py-1 text-left">
                  {row.keterangan}
                </td>
              </tr>
            ))}
            <tr className="bg-[#f5f0e4] font-semibold">
              <td
                colSpan={2}
                className="border border-black px-1 py-1 text-center"
              >
                TOTAL
              </td>
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.ppnMasukan)}
              </td>
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.ppnPengeluaran)}
              </td>
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.pph22Masukan)}
              </td>
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.pph22Pengeluaran)}
              </td>
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.pphFinalMasukan)}
              </td>
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.pphFinalPengeluaran)}
              </td>
              <td className="border border-black" />
            </tr>
            <tr className="font-semibold">
              <td
                colSpan={2}
                className="border border-black px-1 py-1 text-center uppercase"
              >
                Pajak Tertanggung
              </td>
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.ppnPengeluaran)}
              </td>
              <td className="border border-black" />
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.pph22Pengeluaran)}
              </td>
              <td className="border border-black" />
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {formatRp(t.pphFinalPengeluaran)}
              </td>
              <td className="border border-black" />
              <td className="border border-black px-1 py-1 text-right tabular-nums">
                Rp {rekap.pajakTertanggung.toLocaleString("id-ID")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <SignCol
          labels={["", "Mengetahui,"]}
          title={`Kepala Sekolah ${school}`}
          name={meta.kepalaNama}
          nip={meta.kepalaNip}
        />
        <SignCol
          labels={["", "Menyetujui,"]}
          title="Ketua Tim Pelaksana"
          name={meta.ketuaNama}
          nip={meta.ketuaNip}
        />
        <SignCol
          labels={[placeDate, "Dibuat Oleh;"]}
          title="Bendahara Pembangunan"
          name={meta.bendaharaNama}
          nip={meta.bendaharaNip}
        />
      </div>
    </article>
  );
}
