import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAccessibleProjectIds,
  isAdminProyek,
  requireLpjAccess,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export default async function AdminLpjProjectListPage() {
  const user = await requireLpjAccess();
  const accessible = await getAccessibleProjectIds(user);

  // Admin Proyek: langsung ke menu LPJ proyeknya (1 proyek)
  if (isAdminProyek(user)) {
    if (accessible === "all" || accessible.length === 0) {
      return (
        <div>
          <PageHeader
            title="Proyek LPJ"
            description="Belum ada proyek mandiri yang ditugaskan."
          />
          <EmptyState message="Hubungi Owner untuk menugaskan Anda ke satu proyek mandiri." />
        </div>
      );
    }
    redirect(`/admin/lpj/${accessible[0]}`);
  }

  const projects = await prisma.project.findMany({
    where: {
      status: "ACTIVE",
      ...(accessible === "all" ? {} : { id: { in: accessible } }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      location: true,
      contractValue: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="Proyek LPJ"
        description="Pilih proyek aktif untuk membuka menu LPJ Swakelola."
      />

      {projects.length === 0 ? (
        <EmptyState message="Belum ada proyek aktif." />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/lpj/${p.id}`}
                className="block rounded-xl border border-[var(--line-soft)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(26,47,42,0.04)] transition hover:border-[var(--accent)]/40 hover:bg-[var(--paper-tint)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 sm:p-5"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="font-serif text-xl text-[var(--ink)]">
                    {p.name.trim().toUpperCase()}
                  </h3>
                  <span className="text-sm font-medium text-[var(--accent)]">
                    {formatRupiah(p.contractValue)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {tidyCase(p.location)}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                  Buka menu proyek →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6 text-sm text-[var(--ink-muted)]">
        Modul LPJ AdminOK: baca buku kas dan susun LPJ. Split nota / + tambah
        nota tetap khusus AdminOK.
      </Card>
    </div>
  );
}
