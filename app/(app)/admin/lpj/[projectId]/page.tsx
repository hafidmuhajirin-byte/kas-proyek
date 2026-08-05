import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { PageHeader } from "@/components/ui";

const MENU = [
  {
    href: "spk",
    title: "Ringkasan SPK",
    desc: "Pecah nilai kontrak ke kategori pagu + target upah/material",
  },
  {
    href: "bank",
    title: "Pencairan Bank",
    desc: "Tahap 70% dan 30% + Buku Bank",
  },
  {
    href: "nota",
    title: "Review Nota Mandor",
    desc: "Approve / reject / pecah bahan–upah + material alam",
  },
  {
    href: "absen",
    title: "Absen & Rekap Gaji",
    desc: "Daftar pekerja, absensi, HOK = hadir × upah harian",
  },
  {
    href: "pajak",
    title: "Pajak",
    desc: "Progress plafon 3,5% SPK + daftar PPN/PPh",
  },
  {
    href: "export",
    title: "Laporan LPJ",
    desc: "Pratinjau Buku Bank, BKU, BKT, Rekap Pajak + cetak",
  },
] as const;

export default async function AdminLpjProjectMenuPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireRoleAdmin();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      location: true,
      contractValue: true,
      status: true,
    },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  return (
    <div>
      <PageHeader
        title={tidyCase(project.name)}
        description={`${tidyCase(project.location)} · SPK ${formatRupiah(project.contractValue)}`}
        actions={
          <Link
            href="/admin/lpj"
            className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
          >
            ← Daftar proyek
          </Link>
        }
      />

      <nav aria-label="Menu LPJ proyek">
        <ul className="grid gap-3 sm:grid-cols-2">
          {MENU.map((item) => (
            <li key={item.href}>
              <Link
                href={`/admin/lpj/${project.id}/${item.href}`}
                className="flex h-full flex-col rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/40 hover:bg-[var(--paper-tint)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 sm:p-5"
              >
                <span className="font-serif text-lg text-[var(--ink)]">
                  {item.title}
                </span>
                <span className="mt-1 text-sm text-[var(--ink-muted)]">
                  {item.desc}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
