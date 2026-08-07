import Link from "next/link";
import { format } from "date-fns";
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
            where: { present: true },
            orderBy: { date: "desc" },
            take: 31,
          },
          payrollLines: {
            orderBy: { periodMonth: "asc" },
          },
        },
      },
      payrollHokLines: {
        orderBy: [{ periodMonth: "asc" }, { worker: { name: "asc" } }],
        include: {
          worker: { select: { name: true, role: true } },
        },
      },
    },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  const byPeriod = new Map<string, typeof project.payrollHokLines>();
  for (const row of project.payrollHokLines) {
    const list = byPeriod.get(row.periodMonth) ?? [];
    list.push(row);
    byPeriod.set(row.periodMonth, list);
  }

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
        Data diisi otomatis saat Admin menyimpan pecah nota{" "}
        <strong>Bayar pekerja</strong> (periode tanggal + hari kerja). HOK =
        hari × upah harian.
      </Card>

      {byPeriod.size > 0 ? (
        <div className="mb-6 space-y-4">
          <h3 className="font-medium text-[var(--ink)]">Rekap gaji</h3>
          {[...byPeriod.entries()].map(([period, rows]) => {
            const total = rows.reduce((s, r) => s + r.amount, 0);
            return (
              <Card key={period}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-[var(--ink)]">{period}</p>
                  <p className="tabular-nums text-sm text-[var(--rose-ink)]">
                    {formatRupiah(total)}
                  </p>
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[var(--ink-muted)]">
                      <th className="pb-1 font-medium">Nama</th>
                      <th className="pb-1 font-medium">Peran</th>
                      <th className="pb-1 text-right font-medium">Hari</th>
                      <th className="pb-1 text-right font-medium">Upah</th>
                      <th className="pb-1 text-right font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-[var(--line-soft)]"
                      >
                        <td className="py-1.5">{r.worker.name}</td>
                        <td className="py-1.5 text-[var(--ink-muted)]">
                          {r.worker.role}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {r.days}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatRupiah(r.dailyWage)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-[var(--rose-ink)]">
                          {formatRupiah(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
      ) : null}

      {project.workers.length === 0 ? (
        <EmptyState message="Belum ada pekerja terdaftar untuk proyek ini. Simpan pecah nota Bayar pekerja untuk mulai." />
      ) : (
        <div className="space-y-3">
          <h3 className="font-medium text-[var(--ink)]">Pekerja & absensi</h3>
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
                        {w.attendances.length > 0 ? (
                          <p className="mt-1 text-xs text-[var(--ink-faint)]">
                            Hadir:{" "}
                            {w.attendances
                              .slice(0, 10)
                              .map((a) => format(a.date, "dd/MM"))
                              .join(", ")}
                            {w.attendances.length > 10 ? "…" : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right text-sm">
                        <p>Hadir tercatat: {presentDays} hari</p>
                        <p className="font-medium">HOK ≈ {formatRupiah(hok)}</p>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
