import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { getTaxCeilingStatus } from "@/lib/lpj/tax-compliance";
import {
  buildTaxRekap,
  suggestTaxYears,
} from "@/lib/lpj/build-tax-rekap";
import { TaxCeilingBar } from "@/components/lpj/TaxCeilingBar";
import { RekapitulasiPembayaranPajak } from "@/components/lpj/RekapitulasiPembayaranPajak";
import { PajakRekapToolbar } from "@/components/lpj/PajakRekapToolbar";
import type { LpjHeaderMeta } from "@/components/lpj/LpjBookPreviews";

export default async function AdminLpjPajakPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  await requireRoleAdmin();
  const { projectId } = await params;
  const sp = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      notes: true,
      location: true,
      contractValue: true,
      status: true,
      lpjKabKota: true,
      lpjProvinsi: true,
      lpjKepalaNama: true,
      lpjKepalaNip: true,
      lpjKetuaNama: true,
      lpjKetuaNip: true,
      lpjBendaharaNama: true,
      lpjBendaharaNip: true,
      lpjNpwp: true,
    },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  const expenses = await prisma.transaction.findMany({
    where: {
      projectId,
      type: "EXPENSE",
      isOwnerPersonal: false,
      isFeeTransfer: false,
      isMandorDisbursement: false,
      isSplitParent: false,
    },
    select: {
      id: true,
      amount: true,
      description: true,
      isMaterialAlam: true,
      isMandorExpense: true,
      breakdownStatus: true,
      date: true,
      category: { select: { name: true } },
      expenseLines: {
        select: {
          amount: true,
          description: true,
          kind: true,
          isMaterialAlam: true,
        },
      },
    },
    orderBy: { date: "asc" },
    take: 500,
  });

  const years = suggestTaxYears(expenses);
  const yearParam = sp.year ? Number(sp.year) : NaN;
  const year =
    Number.isFinite(yearParam) && years.includes(yearParam)
      ? yearParam
      : years[0]!;

  const notes = await prisma.taxMonthNote.findMany({
    where: { projectId, year },
    select: { month: true, keterangan: true },
  });
  const notesByMonth: Record<number, string> = {};
  for (const n of notes) {
    if (n.keterangan) notesByMonth[n.month] = n.keterangan;
  }

  const rekap = buildTaxRekap(
    expenses.map((e) => ({
      date: e.date,
      amount: e.amount,
      description: e.description,
      categoryName: e.category.name,
      isMaterialAlam: e.isMaterialAlam,
      isMandorExpense: e.isMandorExpense,
      breakdownStatus: e.breakdownStatus,
      lines: e.expenseLines,
    })),
    year,
    notesByMonth,
  );

  const ceiling = getTaxCeilingStatus(
    rekap.pajakTertanggung,
    project.contractValue,
  );

  const projectTitle = (project.notes ?? "").trim() || project.name;
  const meta: LpjHeaderMeta = {
    schoolName: project.name,
    location: project.location,
    kabKota: project.lpjKabKota,
    provinsi: project.lpjProvinsi,
    kepalaNama: project.lpjKepalaNama,
    kepalaNip: project.lpjKepalaNip,
    ketuaNama: project.lpjKetuaNama,
    ketuaNip: project.lpjKetuaNip,
    bendaharaNama: project.lpjBendaharaNama,
    bendaharaNip: project.lpjBendaharaNip,
    npwp: project.lpjNpwp,
  };

  return (
    <div className="absen-print-landscape">
      <div className="print:hidden">
        <PageHeader
          title="Pajak"
          description={project.name.trim().toUpperCase()}
          actions={
            <Link
              href={`/admin/lpj/${project.id}`}
              className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
            >
              ← Menu proyek
            </Link>
          }
        />

        <TaxCeilingBar status={ceiling} />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="!p-3">
            <p className="text-xs text-[var(--ink-muted)]">PPN (pengeluaran)</p>
            <p className="font-medium">
              {formatRupiah(rekap.totals.ppnPengeluaran)}
            </p>
          </Card>
          <Card className="!p-3">
            <p className="text-xs text-[var(--ink-muted)]">
              PPh 22 + Final (pengeluaran)
            </p>
            <p className="font-medium">
              {formatRupiah(
                rekap.totals.pph22Pengeluaran +
                  rekap.totals.pphFinalPengeluaran,
              )}
            </p>
          </Card>
          <Card className="!p-3">
            <p className="text-xs text-[var(--ink-muted)]">Pajak tertanggung</p>
            <p className="font-medium">
              {formatRupiah(rekap.pajakTertanggung)}
            </p>
          </Card>
        </div>

        <Card className="mt-4 text-sm text-[var(--ink-muted)]">
          Rekapitulasi diisi otomatis dari nota (PPN 11% + PPh 22 untuk belanja
          manufaktur &gt; Rp 2 jt; PPh Final 3,5% Bayar jasa
          perencana/Pengawas). Judul
          = catatan proyek. Sesuaikan NPWP di bawah, lalu cetak.
        </Card>

        <div className="mt-4">
          <PajakRekapToolbar
            projectId={project.id}
            year={year}
            years={years}
            npwp={project.lpjNpwp ?? ""}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white p-3 print:overflow-visible print:border-0 print:p-0">
        <RekapitulasiPembayaranPajak
          rekap={rekap}
          meta={meta}
          projectTitle={projectTitle}
        />
      </div>
    </div>
  );
}
