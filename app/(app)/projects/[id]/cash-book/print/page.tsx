import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { notFound } from "next/navigation";
import {
  assertProjectAccess,
  requireSession,
} from "@/lib/auth";
import { buildCashBookRows } from "@/lib/project-cash-book";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import { PrintButton } from "@/components/PrintButton";
import { btnSecondaryClass } from "@/components/ui";

/** Halaman cetak → Save as PDF dari browser. */
export default async function ProjectCashBookPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const { id } = await params;
  const ok = await assertProjectAccess(user, id);
  if (!ok) notFound();

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      location: true,
      openingBalance: true,
      transactions: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: {
          date: true,
          type: true,
          amount: true,
          description: true,
          isMandorExpense: true,
          category: { select: { name: true } },
          cashSource: { select: { name: true, type: true } },
        },
      },
    },
  });
  if (!project) notFound();

  const cashOnly = project.transactions.filter(
    (tx) => tx.cashSource.type === "CASH",
  );
  const source = cashOnly.length > 0 ? cashOnly : project.transactions;
  const rows = buildCashBookRows(
    source.map((tx) => ({
      date: tx.date,
      description: tx.description,
      type: tx.type,
      amount: tx.amount,
      isMandorExpense: tx.isMandorExpense,
      categoryName: tx.category.name,
      cashSourceName: tx.cashSource.name,
    })),
    project.openingBalance,
  );
  const last = rows[rows.length - 1];

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/projects/${id}`} className={btnSecondaryClass}>
          ← Kembali
        </Link>
        <PrintButton />
      </div>

      <header className="border-b border-stone-300 pb-3">
        <h1 className="text-lg font-semibold">Buku Kas Tunai</h1>
        <p className="text-sm text-stone-600">
          {tidyCase(project.name)} · {tidyCase(project.location)}
        </p>
        <p className="text-xs text-stone-500">
          Cetak {format(new Date(), "dd MMM yyyy HH:mm", { locale: localeId })}
          {cashOnly.length > 0 ? " · sumber Kas Tunai" : " · semua sumber kas proyek"}
        </p>
      </header>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-stone-400 text-left">
            <th className="py-1.5 pr-2 font-medium">Tanggal</th>
            <th className="py-1.5 pr-2 font-medium">Keterangan</th>
            <th className="py-1.5 pr-2 font-medium">Kategori</th>
            <th className="py-1.5 pr-2 text-right font-medium">Penerimaan</th>
            <th className="py-1.5 pr-2 text-right font-medium">Pengeluaran</th>
            <th className="py-1.5 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-stone-500">
                Belum ada transaksi.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-stone-200 align-top">
                <td className="whitespace-nowrap py-1.5 pr-2">
                  {format(r.date, "dd/MM/yyyy")}
                </td>
                <td className="py-1.5 pr-2">
                  {r.description}
                  {r.skipBalance ? (
                    <span className="text-stone-400"> *</span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-2 text-stone-600">{r.category}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {r.income ? formatRupiah(r.income) : ""}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {r.expense ? formatRupiah(r.expense) : ""}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatRupiah(r.balance)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {last ? (
          <tfoot>
            <tr className="border-t border-stone-400">
              <td colSpan={5} className="py-2 font-medium">
                Saldo akhir
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {formatRupiah(last.balance)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>

      <p className="mt-3 text-[10px] text-stone-400">
        * = laporan Mandor (tidak memotong saldo). Simpan sebagai PDF lewat dialog
        cetak browser (Ctrl/Cmd+P → Save as PDF).
      </p>

      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener('load',function(){setTimeout(function(){window.print()},300)});`,
        }}
      />
    </div>
  );
}
