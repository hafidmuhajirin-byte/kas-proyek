import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLpjAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { ForcePrintLandscape } from "@/components/lpj/ForcePrintLandscape";
import { ForcePrintPortrait } from "@/components/lpj/ForcePrintPortrait";
import { LpjPrintButton } from "@/components/lpj/LpjPrintButton";
import {
  LpjSignatureProvider,
  LpjSignatureToolbar,
} from "@/components/lpj/LpjSignatureControls";
import { loadLpjBooks } from "@/lib/lpj/load-lpj-books";
import { buildBkkVouchersFromBkt } from "@/lib/lpj/build-bkk-vouchers";
import {
  BankBookPreview,
  BkuPreview,
  BktPreview,
} from "@/components/lpj/LpjBookPreviews";
import { BkkKuitansiViewer } from "@/components/lpj/BkkKuitansi";

const BOOKS = {
  bank: {
    title: "Cetak Buku Bank",
    hint: "Hanya Buku Bank — A4 landscape, tiap bulan 1 halaman. Di dialog cetak pastikan Orientasi = Landscape.",
    orientation: "landscape" as const,
  },
  bku: {
    title: "Cetak Buku Kas Umum (BKU)",
    hint: "Hanya BKU — A4 landscape, tiap bulan 1 halaman. Di dialog cetak pastikan Orientasi = Landscape.",
    orientation: "landscape" as const,
  },
  bkt: {
    title: "Cetak Buku Kas Tunai (BKT)",
    hint: "Hanya BKT — A4 landscape, tiap bulan 1 halaman. Di dialog cetak pastikan Orientasi = Landscape.",
    orientation: "landscape" as const,
  },
  bkk: {
    title: "Cetak Kuitansi BKK",
    hint: "Pratinjau satu BKK per layar (Prev/Next). Cetak sekali = semua BKK 1…N, A4 potret, bagian bawah kosong untuk tempel nota.",
    orientation: "portrait" as const,
  },
} as const;

type BookKey = keyof typeof BOOKS;

function isBookKey(value: string): value is BookKey {
  return (
    value === "bank" ||
    value === "bku" ||
    value === "bkt" ||
    value === "bkk"
  );
}

export default async function AdminLpjCetakBookPage({
  params,
}: {
  params: Promise<{ projectId: string; book: string }>;
}) {
  const { projectId, book: bookParam } = await params;
  await requireLpjAccess(projectId);
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
    kepalaTtdUrl: project.lpjKepalaTtdUrl,
    ketuaTtdUrl: project.lpjKetuaTtdUrl,
    bendaharaTtdUrl: project.lpjBendaharaTtdUrl,
    stempelUrl: project.lpjStempelUrl,
  };
  const info = BOOKS[book];
  const vouchers =
    book === "bkk" ? buildBkkVouchersFromBkt(books.bktBlocks) : [];

  return (
    <LpjSignatureProvider projectId={project.id}>
      <div
        className={
          info.orientation === "landscape"
            ? "lpj-export-print"
            : "bkk-kuitansi-root"
        }
      >
        {info.orientation === "landscape" ? (
          <ForcePrintLandscape />
        ) : (
          <ForcePrintPortrait />
        )}
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
                <LpjPrintButton label="Cetak / PDF" />
              </div>
            }
          />
          <Card className="mb-4 text-sm text-[var(--ink-muted)]">
            {info.hint}
          </Card>
          <LpjSignatureToolbar className="mb-4" />
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
          {book === "bkk" ? (
            <BkkKuitansiViewer
              vouchers={vouchers}
              meta={meta}
              projectTitle={projectTitle}
            />
          ) : null}
        </section>
      </div>
    </LpjSignatureProvider>
  );
}
