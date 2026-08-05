import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { tidyCase } from "@/lib/text";
import { formatRupiah } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { loadLpjBooks } from "@/lib/lpj/load-lpj-books";
import {
  BankBookPreview,
  BkuPreview,
  BktPreview,
  PajakPreview,
} from "@/components/lpj/LpjBookPreviews";

const SECTIONS = [
  { id: "bank", title: "1. Buku Bank" },
  { id: "bku", title: "2. Buku Kas Umum (BKU)" },
  { id: "bkt", title: "3. Buku Kas Tunai (BKT)" },
  { id: "pajak", title: "4. Rekap Pajak" },
] as const;

export default async function AdminLpjExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireRoleAdmin();
  const { projectId } = await params;
  const books = await loadLpjBooks(projectId);
  if (!books) notFound();

  const { project } = books;

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Laporan LPJ"
          description={`${tidyCase(project.name)} · ${tidyCase(project.location)} · SPK ${formatRupiah(project.contractValue)}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/lpj/${project.id}`}
                className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
              >
                ← Menu proyek
              </Link>
              <PrintButton label="Cetak / PDF" />
            </div>
          }
        />

        <nav className="mb-4 flex flex-wrap gap-2 text-sm">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-[var(--line-soft)] px-3 py-1.5 text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <Card className="mb-4 text-sm text-[var(--ink-muted)]">
          Pratinjau laporan di bawah. Unduh Excel/PDF A4 file menyusul — untuk
          sementara gunakan tombol <strong>Cetak</strong> (Save as PDF).
        </Card>
      </div>

      <header className="mb-6 hidden border-b border-stone-300 pb-3 print:block">
        <h1 className="text-lg font-semibold">Laporan Pertanggungjawaban (LPJ)</h1>
        <p className="text-sm text-stone-600">
          {tidyCase(project.name)} · {tidyCase(project.location)}
        </p>
        <p className="text-sm text-stone-600">
          Nilai SPK {formatRupiah(project.contractValue)} · Cair 70%{" "}
          {formatRupiah(books.trancheSummary.phase70Received)} · Cair 30%{" "}
          {formatRupiah(books.trancheSummary.phase30Received)} · Pengambilan{" "}
          {formatRupiah(books.trancheSummary.totalPengambilan)}
        </p>
      </header>

      <section id="bank" className="mb-8 scroll-mt-20">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">
            Buku Bank
          </h2>
          <BankBookPreview
            blocks={books.bankBlocks}
            meta={{
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
            }}
          />
        </Card>
      </section>

      <section id="bku" className="mb-8 scroll-mt-20">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)] print:hidden">
            Buku Kas Umum (BKU)
          </h2>
          <BkuPreview
            blocks={books.bkuBlocks}
            projectTitle={project.name}
            meta={{
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
            }}
          />
        </Card>
      </section>

      <section id="bkt" className="mb-8 scroll-mt-20">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">
            Buku Kas Tunai (BKT)
          </h2>
          <p className="mb-3 text-sm text-[var(--ink-muted)]">
            Hanya transaksi sumber kas Tunai.
          </p>
          <BktPreview rows={books.bktRows} />
        </Card>
      </section>

      <section id="pajak" className="mb-8 scroll-mt-20">
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">
            Rekap Pajak
          </h2>
          <PajakPreview
            rows={books.taxRows}
            totals={books.taxTotals}
            ceiling={books.taxCeiling}
          />
        </Card>
      </section>
    </div>
  );
}
