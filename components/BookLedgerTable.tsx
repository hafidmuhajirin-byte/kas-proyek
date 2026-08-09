import type { ReactNode } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { formatRupiah } from "@/lib/money";
import { moneyCell } from "@/lib/report-ledger";
import { ProofReviewLink } from "@/components/ProofReviewLink";

export type BookRow = {
  id: string;
  date: Date;
  projectLabel?: string;
  projectHref?: string;
  keterangan: ReactNode;
  meta?: string;
  penerimaan: number;
  pengeluaran: number;
  saldo: number;
  skipBalance?: boolean;
  proofHref?: string | null;
  proofTitle?: string;
  actions?: ReactNode;
  extra?: ReactNode;
};

function OpeningRow({
  opening,
  showProject,
  hasAnyAction,
}: {
  opening: number;
  showProject: boolean;
  hasAnyAction: boolean;
}) {
  return (
    <tr className="bg-teal-50/70">
      <td className="border border-teal-900/10 px-2 py-1.5 text-teal-900/45">
        —
      </td>
      {showProject ? (
        <td className="border border-teal-900/10 px-2 py-1.5 text-teal-900/45">
          —
        </td>
      ) : null}
      <td className="border border-teal-900/10 px-2 py-1.5">Saldo awal</td>
      <td className="border border-teal-900/10 px-2 py-1.5 text-right tabular-nums text-emerald-800">
        {moneyCell(opening)}
      </td>
      <td className="border border-teal-900/10 px-2 py-1.5 text-center text-teal-900/35">
        —
      </td>
      <td className="border border-teal-900/10 px-2 py-1.5 text-right tabular-nums font-medium">
        {formatRupiah(opening)}
      </td>
      {hasAnyAction ? (
        <td className="border border-teal-900/10 px-2 py-1.5 print:hidden" />
      ) : null}
    </tr>
  );
}

function LedgerBodyRow({
  row,
  showProject,
  hasAnyAction,
}: {
  row: BookRow;
  showProject: boolean;
  hasAnyAction: boolean;
}) {
  return (
    <tr
      className={
        row.skipBalance
          ? "bg-amber-50/50"
          : "odd:bg-white even:bg-teal-50/25"
      }
    >
      <td className="border border-teal-900/10 px-2 py-1.5 whitespace-nowrap align-top">
        {format(row.date, "dd/MM/yyyy")}
      </td>
      {showProject ? (
        <td className="border border-teal-900/10 px-2 py-1.5 align-top">
          {row.projectHref && row.projectLabel ? (
            <Link
              href={row.projectHref}
              className="text-teal-800 hover:underline"
            >
              {row.projectLabel}
            </Link>
          ) : (
            (row.projectLabel ?? "—")
          )}
        </td>
      ) : null}
      <td className="border border-teal-900/10 px-2 py-1.5 align-top">
        <div className="text-teal-950">{row.keterangan}</div>
        {row.meta ? (
          <p className="mt-0.5 text-[11px] text-teal-900/50">{row.meta}</p>
        ) : null}
        {row.extra}
      </td>
      <td className="border border-teal-900/10 px-2 py-1.5 text-right align-top whitespace-nowrap tabular-nums text-emerald-800">
        {moneyCell(row.penerimaan)}
      </td>
      <td className="border border-teal-900/10 px-2 py-1.5 text-right align-top whitespace-nowrap tabular-nums text-rose-800">
        {row.skipBalance && row.pengeluaran > 0 ? (
          <span className="text-amber-800/80">
            {moneyCell(row.pengeluaran)}*
          </span>
        ) : (
          moneyCell(row.pengeluaran)
        )}
      </td>
      <td
        className={`border border-teal-900/10 px-2 py-1.5 text-right align-top whitespace-nowrap tabular-nums font-medium ${
          row.saldo < 0 ? "text-rose-700" : "text-teal-950"
        }`}
      >
        {formatRupiah(row.saldo)}
      </td>
      {hasAnyAction ? (
        <td className="border border-teal-900/10 px-2 py-1.5 align-top text-xs print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {row.proofHref ? (
              <ProofReviewLink
                href={row.proofHref}
                title={
                  row.proofTitle ??
                  (typeof row.keterangan === "string"
                    ? row.keterangan
                    : "Bukti")
                }
                className="text-teal-700 underline"
              >
                Bukti
              </ProofReviewLink>
            ) : null}
            {row.actions}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

/** Tabel pembukuan ringkas — mudah dibaca seperti buku kas lapangan. */
export function BookLedgerTable({
  rows,
  opening = 0,
  showProject = false,
  empty = "Belum ada mutasi.",
  footnote,
  showActions = true,
  /** true = tampil terbaru di atas (saldo awal di bawah). rows tetap chrono untuk saldo. */
  newestFirst = false,
}: {
  rows: BookRow[];
  opening?: number;
  showProject?: boolean;
  empty?: string;
  footnote?: string;
  showActions?: boolean;
  newestFirst?: boolean;
}) {
  if (rows.length === 0 && opening <= 0) {
    return <p className="px-1 py-4 text-sm text-teal-900/55">{empty}</p>;
  }

  const hasAnyAction =
    showActions &&
    rows.some((r) => r.actions || r.proofHref);

  const totalIn =
    rows.reduce((s, r) => s + (r.skipBalance ? 0 : r.penerimaan), 0) +
    (opening > 0 ? opening : 0);
  const totalOut = rows.reduce(
    (s, r) => s + (r.skipBalance ? 0 : r.pengeluaran),
    0,
  );
  const saldoAkhir =
    rows.length > 0 ? rows[rows.length - 1].saldo : opening;

  const displayRows = newestFirst ? [...rows].reverse() : rows;
  const labelCols = showProject ? 3 : 2;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
        <thead>
          <tr className="bg-teal-800 text-white">
            <th className="border border-teal-900/20 px-2 py-2 font-medium">
              Tanggal
            </th>
            {showProject ? (
              <th className="border border-teal-900/20 px-2 py-2 font-medium">
                Proyek
              </th>
            ) : null}
            <th className="border border-teal-900/20 px-2 py-2 font-medium">
              Keterangan
            </th>
            <th className="border border-teal-900/20 px-2 py-2 text-right font-medium">
              Penerimaan
            </th>
            <th className="border border-teal-900/20 px-2 py-2 text-right font-medium">
              Pengeluaran
            </th>
            <th className="border border-teal-900/20 px-2 py-2 text-right font-medium">
              Saldo
            </th>
            {hasAnyAction ? (
              <th className="border border-teal-900/20 px-2 py-2 font-medium print:hidden">
                Aksi
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {!newestFirst && opening > 0 ? (
            <OpeningRow
              opening={opening}
              showProject={showProject}
              hasAnyAction={hasAnyAction}
            />
          ) : null}

          {displayRows.map((row) => (
            <LedgerBodyRow
              key={row.id}
              row={row}
              showProject={showProject}
              hasAnyAction={hasAnyAction}
            />
          ))}

          {newestFirst && opening > 0 ? (
            <OpeningRow
              opening={opening}
              showProject={showProject}
              hasAnyAction={hasAnyAction}
            />
          ) : null}
        </tbody>
        <tfoot>
          <tr className="bg-teal-800/10 font-medium">
            <td
              colSpan={labelCols}
              className="border border-teal-900/10 px-2 py-2 text-right"
            >
              Jumlah
              {footnote ? (
                <span className="ml-1 font-normal text-teal-900/50">
                  · {footnote}
                </span>
              ) : null}
            </td>
            <td className="border border-teal-900/10 px-2 py-2 text-right tabular-nums text-emerald-800">
              {moneyCell(totalIn)}
            </td>
            <td className="border border-teal-900/10 px-2 py-2 text-right tabular-nums text-rose-800">
              {moneyCell(totalOut)}
            </td>
            <td className="border border-teal-900/10 px-2 py-2 text-right tabular-nums">
              {formatRupiah(saldoAkhir)}
            </td>
            {hasAnyAction ? (
              <td className="border border-teal-900/10 px-2 py-2 print:hidden" />
            ) : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Strip ringkas angka pembukuan. */
export function BookSummaryStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    hint?: string;
    tone?: "in" | "out" | "bal";
  }>;
}) {
  const cols =
    items.length <= 3
      ? "grid-cols-3"
      : items.length === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <div
      className={`mb-3 grid ${cols} gap-px overflow-hidden rounded border border-teal-900/15 bg-teal-900/10`}
    >
      {items.map((item) => {
        const color =
          item.tone === "in"
            ? "text-emerald-800"
            : item.tone === "out"
              ? "text-rose-800"
              : "text-teal-950";
        return (
          <div key={item.label} className="bg-[#fffcf7] px-2 py-2 sm:px-3">
            <p className="text-[10px] tracking-wide text-teal-900/50 uppercase">
              {item.label}
            </p>
            <p
              className={`mt-0.5 text-sm font-medium tabular-nums sm:text-base ${color}`}
            >
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-0.5 text-[10px] leading-snug text-teal-900/45">
                {item.hint}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
