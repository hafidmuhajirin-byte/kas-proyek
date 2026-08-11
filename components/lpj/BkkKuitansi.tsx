"use client";

import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { tidyCase } from "@/lib/text";
import { formatBktQty } from "@/lib/buku-kas/bkt";
import { parseProjectLocation } from "@/lib/project-bkk-report";
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

function formatQtyDisplay(qty: number | null) {
  if (qty == null) return "";
  return formatBktQty(qty);
}

/** Ringkas uraian pembayaran dari baris kuitansi / judul pekerjaan. */
function paymentPurpose(voucher: BkkVoucher, projectTitle: string) {
  const title = projectTitle.trim();
  if (title) return title;
  if (voucher.lines.length === 1) {
    return voucher.lines[0]?.description?.trim() || "Pengeluaran kas";
  }
  if (voucher.lines.length > 1) {
    return `Pembelanjaan ${voucher.proofNo}`;
  }
  return "Pengeluaran kas";
}

function FieldRow({
  label,
  children,
  right,
}: {
  label: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[9.5rem_0.6rem_1fr] items-baseline gap-x-1 text-[11px] leading-snug sm:grid-cols-[10.5rem_0.6rem_1fr]">
      <span className="text-stone-800">{label}</span>
      <span className="text-stone-800">:</span>
      <div className="min-w-0">
        {right ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <div className="min-w-0 flex-1">{children}</div>
            <div className="shrink-0 text-[11px]">{right}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function VoucherSheet({
  voucher,
  meta,
  school,
  projectTitle,
  kecamatan,
}: {
  voucher: BkkVoucher;
  meta: LpjHeaderMeta;
  school: string;
  projectTitle: string;
  kecamatan: string;
}) {
  const place = kecamatan || meta.kabKota?.trim() || "";
  const placeLabel = place ? tidyCase(place) : "";
  const dateLabel = format(voucher.date, "dd MMMM yyyy", { locale: localeId });
  const placeDate = placeLabel ? `${placeLabel.toUpperCase()} : ${dateLabel}` : dateLabel;
  const purpose = paymentPurpose(voucher, projectTitle);
  const terbilang = terbilangRupiah(voucher.total);

  return (
    <article className="bkk-kuitansi-sheet flex min-h-[277mm] flex-col bg-white text-[11px] text-stone-900 print:min-h-0">
      {/* Bagian atas: formulir kuitansi model referensi */}
      <div className="flex flex-[0_0_50%] flex-col border-2 border-double border-stone-800 p-3 print:min-h-[138mm] sm:p-4">
        <h1 className="border border-stone-700 bg-stone-200 py-1.5 text-center text-sm font-bold uppercase tracking-wide text-stone-900 sm:text-base">
          Kuitansi Pembayaran
        </h1>

        <div className="mt-3 space-y-1.5">
          <FieldRow label="Nomor">
            <span className="font-bold underline decoration-1 underline-offset-2">
              {voucher.proofNo}
            </span>
          </FieldRow>

          <FieldRow
            label="Sudah terima dari"
            right={
              placeLabel ? (
                <span>
                  Kecamatan :{" "}
                  <span className="font-medium uppercase">{placeLabel}</span>
                </span>
              ) : null
            }
          >
            <span className="font-semibold uppercase">{school}</span>
          </FieldRow>

          <FieldRow label="Uang sebesar">
            <p className="bg-stone-100 px-2 py-1 font-semibold italic text-stone-900">
              {terbilang}
            </p>
          </FieldRow>

          <FieldRow label="Untuk pembayaran">
            <span className="font-medium underline decoration-1 underline-offset-2">
              {purpose}
            </span>
          </FieldRow>
        </div>

        <div className="mt-3 flex-1">
          <table className="w-full border-collapse text-left">
            <tbody>
              {voucher.lines.map((line, i) => (
                <tr
                  key={`${voucher.proofNo}-${i}`}
                  className="border-b border-dotted border-stone-400 align-top"
                >
                  <td className="w-[3.2rem] py-1 pr-2 tabular-nums text-stone-800">
                    {formatQtyDisplay(line.quantity)}
                  </td>
                  <td className="w-[2.4rem] py-1 pr-2 text-stone-700">
                    {line.unit ?? ""}
                  </td>
                  <td className="py-1 font-serif italic text-stone-900">
                    {line.description}
                  </td>
                </tr>
              ))}
              {/* Baris kosong agar area daftar tidak terlalu pendek */}
              {voucher.lines.length < 5
                ? Array.from({ length: 5 - voucher.lines.length }).map((_, i) => (
                    <tr
                      key={`pad-${i}`}
                      className="border-b border-dotted border-stone-300"
                    >
                      <td className="py-2.5" colSpan={3} />
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-stretch border border-stone-800">
          <div className="flex items-center border-r border-stone-800 px-3 py-2 text-sm font-semibold">
            Rp.
          </div>
          <div className="flex flex-1 items-center justify-end px-3 py-2 text-base font-bold tabular-nums sm:text-lg">
            {formatRp(voucher.total)}
          </div>
        </div>

        {/* Tiga kolom TTD: Mengetahui | Lunas dibayar | Penerima */}
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="text-center text-[10px] leading-snug sm:text-[11px]">
            <p>Mengetahui;</p>
            <p className="mt-0.5 font-medium">
              Kepala Sekolah {tidyCase(school)}
            </p>
            <div className="relative mx-auto my-1 h-16 w-full sm:h-[4.5rem]">
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
            <p className="font-bold uppercase underline decoration-1 underline-offset-2">
              {meta.kepalaNama?.trim() || "................................"}
            </p>
            <p className="mt-0.5">
              {meta.kepalaNip?.trim()
                ? `NIP. ${meta.kepalaNip.trim()}`
                : "NIP. ........................"}
            </p>
          </div>

          <div className="text-center text-[10px] leading-snug sm:text-[11px]">
            <p>Lunas dibayar, {placeDate}</p>
            <p className="mt-0.5 font-medium">
              Bendahara Pembangunan {tidyCase(school)}
            </p>
            <div className="relative mx-auto my-1 h-16 w-full sm:h-[4.5rem]">
              {meta.bendaharaTtdUrl ? (
                <LpjSignatureMark
                  kind="ttd"
                  markId={`bkk-bendahara-${voucher.proofNo}`}
                  src={meta.bendaharaTtdUrl}
                  alt="TTD Bendahara"
                />
              ) : null}
            </div>
            <p className="font-bold uppercase underline decoration-1 underline-offset-2">
              {meta.bendaharaNama?.trim() || "................................"}
            </p>
            <p className="mt-0.5">
              {meta.bendaharaNip?.trim()
                ? `NIP. ${meta.bendaharaNip.trim()}`
                : "NIP. ........................"}
            </p>
          </div>

          <div className="text-center text-[10px] leading-snug sm:text-[11px]">
            <p>{placeDate}</p>
            <p className="mt-0.5 font-medium">Penerima</p>
            <div
              className="relative mx-auto my-1 h-16 w-full sm:h-[4.5rem]"
              aria-hidden
            />
            <p className="font-bold uppercase underline decoration-1 underline-offset-2">
              ................................
            </p>
            <p className="mt-0.5 text-stone-500">(nama terang)</p>
          </div>
        </div>
      </div>

      {/* Bagian bawah: kosong untuk menempel nota fisik */}
      <div className="flex flex-[0_0_50%] flex-col items-center justify-center border border-t-0 border-dashed border-stone-400 p-4 text-center text-stone-400 print:min-h-[138mm]">
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
  const loc = parseProjectLocation(meta.location);
  const kecamatan =
    loc.kecamatan !== "—" ? loc.kecamatan : meta.kabKota?.trim() || "";

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

      <div className="print:hidden mx-auto max-w-[210mm]">
        <VoucherSheet
          voucher={current}
          meta={meta}
          school={school}
          projectTitle={projectTitle}
          kecamatan={kecamatan}
        />
      </div>

      <div className="hidden print:block">
        {vouchers.map((v) => (
          <div key={v.proofNo} className="bkk-kuitansi-page">
            <VoucherSheet
              voucher={v}
              meta={meta}
              school={school}
              projectTitle={projectTitle}
              kecamatan={kecamatan}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
