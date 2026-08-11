import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLpjAccess } from "@/lib/auth";
import { tidyCase } from "@/lib/text";
import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { loadLpjBooks } from "@/lib/lpj/load-lpj-books";
import {
  buildTaxRekap,
  suggestTaxYears,
} from "@/lib/lpj/build-tax-rekap";
import {
  BankBookPreview,
  BkuPreview,
  BktPreview,
} from "@/components/lpj/LpjBookPreviews";
import { RekapitulasiPembayaranPajak } from "@/components/lpj/RekapitulasiPembayaranPajak";
import { LpjExcelDownloadButton } from "@/components/lpj/LpjExcelDownloadButton";

const CETAK_LINKS = [
  {
    href: "bank",
    title: "Cetak Buku Bank",
    desc: "Hanya Buku Bank — A4 landscape, per bulan",
  },
  {
    href: "bku",
    title: "Cetak Buku Kas Umum",
    desc: "Hanya BKU — A4 landscape, per bulan",
  },
  {
    href: "bkt",
    title: "Cetak Buku Kas Tunai",
    desc: "Hanya BKT — A4 landscape, per bulan",
  },
] as const;

export default async function AdminLpjExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireLpjAccess(projectId);
  const books = await loadLpjBooks(projectId);
  if (!books) notFound();

  const { project } = books;
  const projectExtra = await prisma.project.findUnique({
    where: { id: projectId },
    select: { notes: true, lpjNpwp: true },
  });

  const years = suggestTaxYears(books.taxRows.map((r) => ({ date: r.date })));
  const year = years[0]!;
  const notes = await prisma.taxMonthNote.findMany({
    where: { projectId, year },
    select: { month: true, keterangan: true },
  });
  const notesByMonth: Record<number, string> = {};
  for (const n of notes) {
    if (n.keterangan) notesByMonth[n.month] = n.keterangan;
  }

  const expensesForRekap = await prisma.transaction.findMany({
    where: {
      projectId,
      type: "EXPENSE",
      isOwnerPersonal: false,
      isFeeTransfer: false,
      isMandorDisbursement: false,
      isSplitParent: false,
    },
    select: {
      date: true,
      amount: true,
      description: true,
      isMaterialAlam: true,
      isMandorExpense: true,
      breakdownStatus: true,
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
  });
  const taxRekap = buildTaxRekap(
    expensesForRekap.map((e) => ({
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
  const projectTitle =
    (projectExtra?.notes ?? "").trim() || project.name;
  const meta = {
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
    kepalaTtdUrl: project.lpjKepalaTtdUrl,
    ketuaTtdUrl: project.lpjKetuaTtdUrl,
    bendaharaTtdUrl: project.lpjBendaharaTtdUrl,
    stempelUrl: project.lpjStempelUrl,
  };

  return (
    <div>
      <PageHeader
        title="Laporan LPJ"
        description={`${project.name.trim().toUpperCase()} · ${tidyCase(project.location)} · SPK ${formatRupiah(project.contractValue)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/lpj/${project.id}`}
              className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
            >
              ← Menu proyek
            </Link>
            <LpjExcelDownloadButton projectId={project.id} />
          </div>
        }
      />

      <Card className="mb-4 space-y-2 text-sm text-[var(--ink-muted)]">
        <p>
          Cetak dipisah per buku agar file PDF tidak bercampur. Tiap bulan
          diusahakan memenuhi 1 lembar <strong>A4 landscape</strong>. Di dialog
          cetak/PDF, pastikan <strong>Orientasi = Landscape</strong>.
        </p>
        <p>
          <strong>Unduh Excel Workbook</strong> berisi sheet BUKU BANK, BKU per
          bulan, dan BKT per bulan — lengkap rumus saldo &amp; jumlah (SUM).
        </p>
      </Card>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {CETAK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={`/admin/lpj/${project.id}/cetak/${item.href}`}
            className="rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/40 hover:bg-[var(--paper-tint)]/40"
          >
            <p className="font-serif text-lg text-[var(--ink)]">{item.title}</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">{item.desc}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              Buka & cetak →
            </p>
          </Link>
        ))}
      </div>

      <section id="bank" className="mb-8 scroll-mt-20">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">
            Pratinjau Buku Bank
          </h2>
          <BankBookPreview blocks={books.bankBlocks} meta={meta} />
        </Card>
      </section>

      <section id="bku" className="mb-8 scroll-mt-20">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">
            Pratinjau Buku Kas Umum (BKU)
          </h2>
          <BkuPreview
            blocks={books.bkuBlocks}
            projectTitle={projectTitle}
            meta={meta}
          />
        </Card>
      </section>

      <section id="bkt" className="mb-8 scroll-mt-20">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">
            Pratinjau Buku Kas Tunai (BKT)
          </h2>
          <BktPreview
            blocks={books.bktBlocks}
            projectTitle={projectTitle}
            meta={meta}
          />
        </Card>
      </section>

      <section id="pajak" className="mb-8 scroll-mt-20">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">
            Pratinjau Rekap Pajak
          </h2>
          <p className="mb-3 text-sm text-[var(--ink-muted)]">
            Cetak rekap pajak dari menu{" "}
            <Link
              href={`/admin/lpj/${project.id}/pajak`}
              className="text-[var(--accent)] underline"
            >
              Pajak
            </Link>
            .
          </p>
          <RekapitulasiPembayaranPajak
            rekap={taxRekap}
            projectTitle={projectTitle}
            meta={{
              ...meta,
              npwp: projectExtra?.lpjNpwp,
            }}
          />
        </Card>
      </section>
    </div>
  );
}
