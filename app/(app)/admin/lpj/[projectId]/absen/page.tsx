import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import { formatRupiah } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export default async function AdminLpjAbsenPage({
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
      status: true,
      workers: {
        where: { active: true },
        orderBy: { name: "asc" },
        include: {
          attendances: {
            orderBy: { date: "desc" },
            take: 14,
          },
        },
      },
    },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  return (
    <div>
      <PageHeader
        title="Absen & Rekap Gaji"
        description={tidyCase(project.name)}
        actions={
          <Link
            href={`/admin/lpj/${project.id}`}
            className="rounded-lg border border-[var(--line-soft)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--paper-tint)]"
          >
            ← Menu proyek
          </Link>
        }
      />

      <Card className="mb-4 text-sm text-[var(--ink-muted)]">
        Form tambah pekerja & absensi Mandor akan dilanjutkan. Saat ini menampilkan
        data yang sudah ada. HOK = jumlah hari hadir × upah harian.
      </Card>

      {project.workers.length === 0 ? (
        <EmptyState message="Belum ada pekerja terdaftar untuk proyek ini." />
      ) : (
        <ul className="space-y-3">
          {project.workers.map((w) => {
            const presentDays = w.attendances.filter((a) => a.present).length;
            const hok = presentDays * w.dailyWage;
            return (
              <li key={w.id}>
                <Card>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-sm text-[var(--ink-muted)]">
                        {w.role} · Upah harian {formatRupiah(w.dailyWage)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>Hadir (14 hari terakhir): {presentDays}</p>
                      <p className="font-medium">HOK ≈ {formatRupiah(hok)}</p>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
