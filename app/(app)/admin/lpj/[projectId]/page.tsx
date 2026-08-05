import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { Card, PageHeader } from "@/components/ui";
import { collectOwnerPengambilan } from "@/lib/lpj/owner-pengambilan";

const MENU = [
  {
    href: "spk",
    title: "Ringkasan SPK",
    desc: "Pecah nilai kontrak ke kategori pagu + target upah/material",
  },
  {
    href: "bank",
    title: "Pencairan & Buku Bank",
    desc: "Cair 70%/30% + pengambilan User→Owner (otomatis dari pemasukan Owner)",
  },
  {
    href: "nota",
    title: "Review Nota Mandor",
    desc: "Lihat nota, pecahan bahan–upah, dan hitungan pajak",
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
      bankTranches: {
        select: { phase: true, receivedAmount: true },
      },
      transactions: {
        where: { type: "INCOME" },
        select: {
          date: true,
          type: true,
          amount: true,
          description: true,
          isOwnerPersonal: true,
          isFeeTransfer: true,
          category: { select: { name: true } },
        },
      },
    },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  const t70 = project.bankTranches.find((t) => t.phase === "PHASE_70");
  const t30 = project.bankTranches.find((t) => t.phase === "PHASE_30");
  const pengambilan = collectOwnerPengambilan(
    project.transactions.map((tx) => ({
      ...tx,
      categoryName: tx.category.name,
    })),
  );
  const totalPengambilan = pengambilan.reduce((s, t) => s + t.amount, 0);

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

      <Card className="mb-5 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-[var(--ink-muted)]">Cair 70%</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {formatRupiah(t70?.receivedAmount ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[var(--ink-muted)]">Cair 30%</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {formatRupiah(t30?.receivedAmount ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[var(--ink-muted)]">
            Pengambilan (User → Owner)
          </p>
          <p className="mt-0.5 font-medium tabular-nums">
            {formatRupiah(totalPengambilan)}
            <span className="ml-1 text-xs font-normal text-[var(--ink-muted)]">
              · {pengambilan.length} kali
            </span>
          </p>
        </div>
      </Card>

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
