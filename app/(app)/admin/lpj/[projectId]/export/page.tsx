import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tidyCase } from "@/lib/text";
import { Card, PageHeader } from "@/components/ui";

export default async function AdminLpjExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireRoleAdmin();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, status: true },
  });
  if (!project || project.status !== "ACTIVE") notFound();

  return (
    <div>
      <PageHeader
        title="Export LPJ"
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

      <Card>
        <p className="text-sm text-[var(--ink-muted)]">
          Export Excel/PDF A4 (Buku Bank, BKU, BKT, Rekap Pajak) menyusul setelah
          builder lengkap. Pratinjau Buku Bank sudah tersedia di menu{" "}
          <Link
            href={`/admin/lpj/${project.id}/bank`}
            className="underline"
          >
            Pencairan Bank
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
