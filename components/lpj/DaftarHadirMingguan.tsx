import { Fragment } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { tidyCase } from "@/lib/text";
import { parseProjectLocation } from "@/lib/project-bkk-report";
import { LABOR_GOL_LABELS } from "@/lib/labor-golongan";
import type { AbsenWeekDetail } from "@/lib/lpj/load-absen-weeks";
import type { LpjHeaderMeta } from "@/components/lpj/LpjBookPreviews";

function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    <div className="flex flex-col text-center text-[10px] leading-snug">
      <div className="mb-2 min-h-[2.5rem] space-y-0.5">
        <p className="min-h-[1rem]">{labels[0] || "\u00a0"}</p>
        <p className="min-h-[1rem]">{labels[1] || "\u00a0"}</p>
      </div>
      <p className="font-medium">{title}</p>
      {org ? <p className="mt-0.5">{tidyCase(org)}</p> : null}
      <div className="min-h-[3.5rem]" />
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
 * DAFTAR HADIR PEKERJA DAN UPAH MINGGUAN — cetak landscape.
 * Subtitle = catatan proyek (notes).
 */
export function DaftarHadirMingguan({
  detail,
  meta,
  projectTitle,
}: {
  detail: AbsenWeekDetail;
  meta: LpjHeaderMeta;
  /** Catatan proyek → judul pekerjaan di bawah header */
  projectTitle: string;
}) {
  const school = tidyCase(meta.schoolName);
  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const placeDate = `${tidyCase(kab)}, ${formatLongId(detail.periodEnd)}`;
  const total = detail.workers.reduce((s, w) => s + w.totalWage, 0);
  const dayCols = detail.dayCols;

  return (
    <article className="daftar-hadir-doc bg-white text-black">
      <header className="mb-2 text-center">
        <h1 className="text-sm font-bold uppercase tracking-wide underline decoration-1">
          Daftar Hadir Pekerja Dan Upah Mingguan
        </h1>
        <p className="mt-1 text-xs font-bold uppercase">
          {tidyCase(projectTitle) || school}
        </p>
      </header>

      <div className="mb-2 flex flex-wrap items-start justify-between gap-3 text-[10px]">
        <div className="space-y-0.5">
          <p>
            <span className="inline-block w-24">Nama Sekolah</span>
            <span>: {school}</span>
          </p>
          <p>
            <span className="inline-block w-24">Lokasi</span>
            <span>: {tidyCase(meta.location)}</span>
          </p>
          <p>
            <span className="inline-block w-24">Minggu ke</span>
            <span>: {detail.weekIndex}</span>
          </p>
          <p>
            <span className="inline-block w-24">Tanggal</span>
            <span>
              : {formatLongId(detail.periodStart)} s/d{" "}
              {formatLongId(detail.periodEnd)}
            </span>
          </p>
        </div>
        <div className="border border-black/70 px-2 py-1 text-[9px] leading-snug">
          <p className="font-semibold">KETERANGAN :</p>
          <p>HOK Gol. A : {LABOR_GOL_LABELS.A}</p>
          <p>HOK Gol. B : {LABOR_GOL_LABELS.B}</p>
          <p>HOK Gol. C : {LABOR_GOL_LABELS.C}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-black text-[9px] leading-tight">
          <thead>
            <tr className="bg-[#e8dcc0] text-center font-semibold">
              <th rowSpan={3} className="border border-black px-0.5 py-1 w-6">
                No
              </th>
              <th rowSpan={3} className="border border-black px-1 py-1 min-w-[5.5rem]">
                Nama Pekerja
              </th>
              <th rowSpan={3} className="border border-black px-0.5 py-1 w-8">
                Gol.
                <br />
                Pekerja
                <br />
                (A/B/C)
              </th>
              <th
                colSpan={14}
                className="border border-black px-1 py-1"
              >
                Absen Harian
              </th>
              <th rowSpan={3} className="border border-black px-0.5 py-1 w-10">
                Jumlah
                <br />
                Hari
                <br />
                Kerja
              </th>
              <th rowSpan={3} className="border border-black px-0.5 py-1 w-10">
                LEMBUR
                <br />/ jam
              </th>
              <th rowSpan={3} className="border border-black px-0.5 py-1 w-14">
                Upah Kerja
                <br />/ hari (Rp)
              </th>
              <th rowSpan={3} className="border border-black px-0.5 py-1 w-14">
                Upah Kerja
                <br />
                Lembur / jam
                <br />
                (Rp)
              </th>
              <th rowSpan={3} className="border border-black px-0.5 py-1 w-16">
                Jumlah Upah
                <br />
                Kerja (Rp)
              </th>
              <th rowSpan={3} className="border border-black px-1 py-1 min-w-[4rem]">
                Tanda
                <br />
                Tangan
              </th>
            </tr>
            <tr className="bg-[#e8dcc0] text-center font-semibold">
              {dayCols.map((d, i) => (
                <th
                  key={`dl-${i}`}
                  colSpan={2}
                  className="border border-black px-0.5 py-0.5"
                >
                  {d.dayLetter}
                </th>
              ))}
            </tr>
            <tr className="bg-[#e8dcc0] text-center font-semibold">
              {dayCols.map((d, i) => (
                <Fragment key={`hdr-${i}`}>
                  <th className="border border-black px-0.5 py-0.5 w-4">
                    {d.date.getUTCDate()}
                  </th>
                  <th className="border border-black px-0.5 py-0.5 w-5 text-[7px] font-normal">
                    lembu
                    <br />/ jam
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.workers.length === 0 ? (
              <tr>
                <td
                  colSpan={22}
                  className="border border-black px-2 py-3 text-center text-[var(--ink-muted)]"
                >
                  Belum ada data pekerja untuk minggu ini.
                </td>
              </tr>
            ) : (
              detail.workers.map((w, idx) => (
                <tr key={w.workerId} className="text-center">
                  <td className="border border-black px-0.5 py-1">{idx + 1}</td>
                  <td className="border border-black px-1 py-1 text-left">
                    {tidyCase(w.name)}
                  </td>
                  <td className="border border-black px-0.5 py-1">{w.gol}</td>
                  {dayCols.map((d, i) => {
                    const present = w.presentByDate[utcKey(d.date)] === true;
                    let mark = "";
                    if (d.inPeriod) mark = present ? "V" : "X";
                    return (
                      <Fragment key={`${w.workerId}-d-${i}`}>
                        <td className="border border-black px-0.5 py-1">
                          {mark}
                        </td>
                        <td className="border border-black px-0.5 py-1" />
                      </Fragment>
                    );
                  })}
                  <td className="border border-black px-0.5 py-1 tabular-nums">
                    {w.workDays || ""}
                  </td>
                  <td className="border border-black px-0.5 py-1 tabular-nums">
                    {w.overtimeHours || ""}
                  </td>
                  <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                    {w.dailyWage > 0
                      ? w.dailyWage.toLocaleString("id-ID")
                      : ""}
                  </td>
                  <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                    {w.overtimeWage > 0
                      ? w.overtimeWage.toLocaleString("id-ID")
                      : ""}
                  </td>
                  <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                    {w.totalWage > 0
                      ? w.totalWage.toLocaleString("id-ID")
                      : ""}
                  </td>
                  <td className="border border-black px-1 py-1 text-left text-[8px]">
                    {idx + 1}. ………
                  </td>
                </tr>
              ))
            )}
            <tr className="font-semibold">
              <td
                colSpan={18}
                className="border border-black px-1 py-1 text-right"
              >
                Total
              </td>
              <td className="border border-black px-0.5 py-1 text-right tabular-nums">
                {total.toLocaleString("id-ID")}
              </td>
              <td className="border border-black" />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-1 text-[8px]">
        *) Jam kerja Harian : Mulai jam 08.00 - 16.00 (7 jam) / istirahat jam
        12.00 - 13.00
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
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
