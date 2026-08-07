import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { loadLpjBooks } from "@/lib/lpj/load-lpj-books";
import {
  BankBookPreview,
  BkuPreview,
  BktPreview,
} from "@/components/lpj/LpjBookPreviews";

const BOOKS = {
  bank: {
    title: "Cetak Buku Bank",
    hint: "Hanya Buku Bank — A4 landscape, tiap bulan 1 halaman.",
  },
  bku: {
    title: "Cetak Buku Kas Umum (BKU)",
    hint: "Hanya BKU — A4 landscape, tiap bulan 1 halaman.",
  },
  bkt: {
    title: "Cetak Buku Kas Tunai (BKT)",
    hint: "Hanya BKT — A4 landscape, tiap bulan 1 halaman.",
  },
} as const;

type BookKey = keyof typeof BOOKS;

function isBookKey(value: string): value is BookKey {
  return value === "bank" || value === "bku" || value === "bkt";
}

export default async function AdminLpjCetakBookPage({
  params,
}: {
  params: Promise<{ projectId: string; book: string }>;
}) {
  await requireRoleAdmin();
  const { projectId, book: bookParam } = await params;
  if (!isBookKey(bookParam)) notFound();
  const book = bookParam;

  const books = await loadLpjBooks(projectId);
  if (!books) notFound();

  const { project } = books;
  const projectExtra = await prisma.project.findUnique({
    where: { id: projectId },
    select: { notes: true },
  });
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
  };
  const info = BOOKS[book];

  return (
    <div className="lpj-export-print">
      <div className="print:hidden">
        <PageHeader
          title={info.title}
          description={project.name.trim().toUpperCase()}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/lpj/${project.id}/export`}
                className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
              >
                ← Laporan LPJ
              </Link>
              <PrintButton label="Cetak / PDF" />
            </div>
          }
        />
        <Card className="mb-4 text-sm text-[var(--ink-muted)]">{info.hint}</Card>
      </div>

      <section className="lpj-book-section">
        {book === "bank" ? (
          <BankBookPreview blocks={books.bankBlocks} meta={meta} />
        ) : null}
        {book === "bku" ? (
          <BkuPreview
            blocks={books.bkuBlocks}
            projectTitle={projectTitle}
            meta={meta}
          />
        ) : null}
        {book === "bkt" ? (
          <BktPreview
            blocks={books.bktBlocks}
            projectTitle={projectTitle}
            meta={meta}
          />
        ) : null}
      </section>
    </div>
  );
}
