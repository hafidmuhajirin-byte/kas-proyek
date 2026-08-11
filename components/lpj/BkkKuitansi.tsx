"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { tidyCase } from "@/lib/text";
import { formatBktQty } from "@/lib/buku-kas/bkt";
import {
  terbilangRupiah,
  type BkkVoucher,
} from "@/lib/lpj/build-bkk-vouchers";
import type { LpjHeaderMeta } from "@/components/lpj/LpjBookPreviews";
import { LpjSignatureMark } from "@/components/lpj/LpjSignatureControls";
import { btnSecondaryClass } from "@/components/ui";

function formatRp(n: number) {
  if (!n) return "0,-";
  return `${new Intl.NumberFormat("id-ID").format(n)},-`;
}

function VoucherSheet({
  voucher,
  meta,
  school,
  projectTitle,
  placeDate,
}: {
  voucher: BkkVoucher;
  meta: LpjHeaderMeta;
  school: string;
  projectTitle: string;
  placeDate: string;
}) {
  return (
    <article className="bkk-kuitansi-sheet flex min-h-[277mm] flex-col border border-stone-400 bg-white text-[11px] text-stone-900 print:min-h-0 print:border-0">
      {/* Bagian atas: formulir kuitansi */}
      <div className="flex flex-[0_0_50%] flex-col border-b border-dashed border-stone-400 p-4 print:min-h-[138mm]">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide">
            {school}
          </p>
          <h1 className="mt-1 font-serif text-lg font-bold underline decoration-1">
            KUITANSI / BUKTI KAS KELUAR
          </h1>
          <p className="mt-0.5 text-[10px] text-stone-600">
            {projectTitle.trim() || school}
          </p>
        </header>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <p>
            <span className="text-stone-500">No. Bukti:</span>{" "}
            <strong>{voucher.proofNo}</strong>
          </p>
          <p className="text-right">
            <span className="text-stone-500">Tanggal:</span>{" "}
            {format(voucher.date, "d MMMM yyyy", { locale: localeId })}
          </p>
        </div>

        <div className="mt-3 flex-1">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-stone-400">
                <th className="py-1 pr-1 font-medium">Status</th>
                <th className="py-1 pr-1 font-medium">Qty</th>
                <th className="py-1 pr-1 font-medium">Sat</th>
                <th className="py-1 pr-1 font-medium">Uraian</th>
                <th className="py-1 pr-1 text-right font-medium">Harga</th>
                <th className="py-1 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {voucher.lines.map((line, i) => (
                <tr key={`${voucher.proofNo}-${i}`} className="align-top">
                  <td className="py-0.5 pr-1">{line.status || ""}</td>
                  <td className="py-0.5 pr-1 tabular-nums">
                    {line.quantity != null ? formatBktQty(line.quantity) : ""}
                  </td>
                  <td className="py-0.5 pr-1">{line.unit ?? ""}</td>
                  <td className="py-0.5 pr-1">{line.description}</td>
                  <td className="py-0.5 pr-1 text-right tabular-nums">
                    {line.unitPrice ? formatRp(line.unitPrice) : ""}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    {formatRp(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 border-t border-stone-400 pt-2">
          <div className="flex justify-between gap-4 font-semibold">
            <span>Jumlah</span>
            <span className="tabular-nums">Rp {formatRp(voucher.total)}</span>
          </div>
          <p className="mt-1 italic text-stone-700">
            Terbilang: {terbilangRupiah(voucher.total)}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-medium">Kepala Sekolah</p>
            <div className="relative mx-auto my-2 h-14 w-full">
              {meta.kepalaTtdUrl ? (
                <LpjSignatureMark
                  kind="ttd"
                  markId={`bkk-kepala-${voucher.proofNo}`}
                  src={meta.kepalaTtdUrl}
                  alt="TTD Kepala"
                />
              ) : null}
              {meta.stempelUrl ? (
                <LpjSignatureMark
                  kind="stamp"
                  markId={`bkk-stempel-${voucher.proofNo}`}
                  src={meta.stempelUrl}
                  alt="Stempel"
                />
              ) : null}
            </div>
            <p className="font-semibold underline decoration-1">
              {meta.kepalaNama?.trim() || "(nama)"}
            </p>
            {meta.kepalaNip?.trim() ? (
              <p className="mt-0.5">NIP. {meta.kepalaNip.trim()}</p>
            ) : null}
          </div>
          <div className="text-center">
            <p>{placeDate}</p>
            <p className="font-medium">Bendahara P2SP</p>
            <div className="relative mx-auto my-2 h-14 w-full">
              {meta.bendaharaTtdUrl ? (
                <LpjSignatureMark
                  kind="ttd"
                  markId={`bkk-bendahara-${voucher.proofNo}`}
                  src={meta.bendaharaTtdUrl}
                  alt="TTD Bendahara"
                />
              ) : null}
            </div>
            <p className="font-semibold underline decoration-1">
              {meta.bendaharaNama?.trim() || "(nama)"}
            </p>
            {meta.bendaharaNip?.trim() ? (
              <p className="mt-0.5">NIP. {meta.bendaharaNip.trim()}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bagian bawah: kosong untuk menempel nota fisik */}
      <div className="flex flex-[0_0_50%] flex-col items-center justify-center p-4 text-center text-stone-400 print:min-h-[138mm]">
        <p className="text-xs uppercase tracking-wide">
          Tempel nota / bukti belanja di sini
        </p>
        <p className="mt-1 text-[10px]">
          {voucher.proofNo} · area kosong A4 bawah
        </p>
      </div>
    </article>
  );
}

export function BkkKuitansiViewer({
  vouchers,
  meta,
  projectTitle,
}: {
  vouchers: BkkVoucher[];
  meta: LpjHeaderMeta;
  projectTitle: string;
}) {
  const [index, setIndex] = useState(0);
  const school = meta.schoolName.trim().toUpperCase();
  const kab = meta.kabKota?.trim() || "";
  const placeDate = kab
    ? `${tidyCase(kab)}, ${format(new Date(), "d MMMM yyyy", { locale: localeId })}`
    : format(new Date(), "d MMMM yyyy", { locale: localeId });

  if (vouchers.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-muted)]">
        Belum ada bukti BKK. Isi nota pengeluaran dulu agar kuitansi terbentuk.
      </p>
    );
  }

  const safeIndex = Math.min(index, vouchers.length - 1);
  const current = vouchers[safeIndex]!;

  return (
    <div className="bkk-kuitansi-print">
      <div className="print:hidden mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={safeIndex <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          ← Prev
        </button>
        <span className="text-sm text-[var(--ink-muted)]">
          BKK {safeIndex + 1} / {vouchers.length}
          <span className="ml-2 font-medium text-[var(--ink)]">
            {current.proofNo}
          </span>
        </span>
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={safeIndex >= vouchers.length - 1}
          onClick={() =>
            setIndex((i) => Math.min(vouchers.length - 1, i + 1))
          }
        >
          Next →
        </button>
        <span className="text-xs text-[var(--ink-muted)]">
          Cetak = semua BKK 1…{vouchers.length} (satu halaman per bukti)
        </span>
      </div>

      {/* Layar: satu lembar */}
      <div className="print:hidden mx-auto max-w-[210mm]">
        <VoucherSheet
          voucher={current}
          meta={meta}
          school={school}
          projectTitle={projectTitle}
          placeDate={placeDate}
        />
      </div>

      {/* Cetak: semua lembar */}
      <div className="hidden print:block">
        {vouchers.map((v) => (
          <div key={v.proofNo} className="bkk-kuitansi-page">
            <VoucherSheet
              voucher={v}
              meta={meta}
              school={school}
              projectTitle={projectTitle}
              placeDate={placeDate}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
