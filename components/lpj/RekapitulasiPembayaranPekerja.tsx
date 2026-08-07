import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { tidyCase } from "@/lib/text";
import { parseProjectLocation } from "@/lib/project-bkk-report";
import type { AbsenWeekSummary } from "@/lib/lpj/load-absen-weeks";
import type { LpjHeaderMeta } from "@/components/lpj/LpjBookPreviews";

function formatShortId(d: Date) {
  return format(d, "d-MMM-yy", { locale: localeId });
}

function formatLongId(d: Date) {
  return format(d, "d MMMM yyyy", { locale: localeId });
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
    <div className="flex flex-col text-center text-xs leading-tight">
      <div className="mb-1 flex h-[2.1rem] flex-col justify-end">
        <p className="min-h-[0.95rem]">{labels[0] || "\u00a0"}</p>
        <p className="min-h-[0.95rem]">{labels[1] || "\u00a0"}</p>
      </div>
      <p className="font-medium">{title}</p>
      {org ? <p className="mt-0.5">{tidyCase(org)}</p> : null}
      <div className="my-3 h-8" />
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
 * REKAPITULASI PEMBAYARAN PEKERJA — cetak A4 potret.
 */
export function RekapitulasiPembayaranPekerja({
  weeks,
  meta,
  projectTitle,
}: {
  weeks: AbsenWeekSummary[];
  meta: LpjHeaderMeta;
  projectTitle: string;
}) {
  const school = tidyCase(meta.schoolName);
  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const kec = loc.kecamatan;
  const prov = meta.provinsi?.trim() || loc.propinsi;
  const lastEnd =
    weeks.length > 0
      ? weeks[weeks.length - 1].periodEnd
      : new Date();
  const placeDate = `${tidyCase(kab)}, ${formatLongId(lastEnd)}`;
  const grandTotal = weeks.reduce((s, w) => s + w.totalAmount, 0);

  // Minimal baris agar mirip formulir
  const rows = [...weeks];
  while (rows.length < 12) {
    rows.push({
      weekIndex: 0,
      label: "",
      periodStart: new Date(0),
      periodEnd: new Date(0),
      paymentDate: new Date(0),
      totalAmount: 0,
      workerCount: 0,
      transactionId: `pad-${rows.length}`,
    });
  }

  return (
    <article className="rekap-pekerja-doc bg-white text-black">
      <header className="mb-3 text-center">
        <h1 className="text-base font-bold uppercase underline decoration-1">
          Rekapitulasi Pembayaran Pekerja
        </h1>
        <p className="mt-1 text-sm font-bold uppercase">
          {tidyCase(projectTitle) || school}
        </p>
      </header>

      <div className="mb-3 space-y-0.5 text-xs">
        <p>
          <span className="inline-block w-24">Sekolah</span>
          <span>: {school}</span>
        </p>
        <p>
          <span className="inline-block w-24">Alamat</span>
          <span>: {tidyCase(loc.alamat)}</span>
        </p>
        <p>
          <span className="inline-block w-24">Kecamatan</span>
          <span>: {tidyCase(kec)}</span>
        </p>
        <p>
          <span className="inline-block w-24">Kabupaten</span>
          <span>: {tidyCase(kab)}</span>
        </p>
        <p>
          <span className="inline-block w-24">Propinsi</span>
          <span>: {tidyCase(prov)}</span>
        </p>
      </div>

      <table className="w-full border-collapse border border-black text-xs">
        <thead>
          <tr className="bg-[#c9a84c] text-center font-semibold">
            <th rowSpan={2} className="border border-black px-1 py-1.5 w-8">
              No
            </th>
            <th
              colSpan={3}
              className="border border-black px-1 py-1.5"
            >
              Uraian Pembayaran Pekerja
            </th>
            <th rowSpan={2} className="border border-black px-1 py-1.5 w-24">
              Tanggal
            </th>
            <th rowSpan={2} className="border border-black px-1 py-1.5 w-32">
              Jumlah
            </th>
          </tr>
          <tr className="bg-[#c9a84c] text-center font-semibold">
            <th className="border border-black px-1 py-1">Uraian</th>
            <th className="border border-black px-1 py-1 w-20">Mulai</th>
            <th className="border border-black px-1 py-1 w-20">Akhir</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w, idx) => {
            const empty = !w.label;
            return (
              <tr key={w.transactionId} className="align-top">
                <td className="border border-black px-1 py-1.5 text-center">
                  {empty ? "" : idx + 1}
                </td>
                <td className="border border-black px-1.5 py-1.5">
                  {w.label}
                </td>
                <td className="border border-black px-1 py-1.5 text-center whitespace-nowrap">
                  {empty ? "" : formatShortId(w.periodStart)}
                </td>
                <td className="border border-black px-1 py-1.5 text-center whitespace-nowrap">
                  {empty ? (
                    ""
                  ) : (
                    <>
                      <span className="text-[10px] text-black/50">s/d </span>
                      {formatShortId(w.periodEnd)}
                    </>
                  )}
                </td>
                <td className="border border-black px-1 py-1.5 text-center whitespace-nowrap">
                  {empty ? "" : formatShortId(w.paymentDate)}
                </td>
                <td className="border border-black px-1.5 py-1.5 text-right tabular-nums">
                  {empty ? (
                    ""
                  ) : (
                    <>
                      <span className="float-left">Rp</span>
                      {w.totalAmount.toLocaleString("id-ID")}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td
              colSpan={5}
              className="border border-black px-1.5 py-1.5 text-right"
            >
              Total
            </td>
            <td className="border border-black px-1.5 py-1.5 text-right tabular-nums">
              <span className="float-left">Rp</span>
              {grandTotal.toLocaleString("id-ID")}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-10 grid grid-cols-2 gap-8">
        <SignCol
          labels={["", "Mengetahui,"]}
          title={`Kepala Sekolah ${school}`}
          name={meta.kepalaNama}
          nip={meta.kepalaNip}
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
