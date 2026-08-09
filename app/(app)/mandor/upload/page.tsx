import { redirect } from "next/navigation";
import {
  getAccessibleProjectIds,
  isFotoOnlyMandor,
  isMandor,
  requireSession,
} from "@/lib/auth";
import { getPencairanOptionsForProject } from "@/lib/mandor-pencairan";
import { prisma } from "@/lib/prisma";
import { MandorUploadForm } from "@/components/MandorUploadForm";
import { Card } from "@/components/ui";

export default async function MandorUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireSession();
  if (!isMandor(user)) redirect("/dashboard");
  if (isFotoOnlyMandor(user)) redirect("/mandor/lokasi");

  const params = await searchParams;
  const ids = await getAccessibleProjectIds(user);
  if (ids === "all" || ids.length === 0) {
    return (
      <Card>
        <p>Belum ada proyek. Hubungi Owner.</p>
      </Card>
    );
  }

  const projects = await prisma.project.findMany({
    where: { id: { in: ids } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const defaultProjectId =
    params.projectId && ids.includes(params.projectId)
      ? params.projectId
      : projects[0]?.id;

  const pencairanChecks = await Promise.all(
    projects.map(async (p) => {
      const opts = await getPencairanOptionsForProject(p.id, {
        mandorId: user.id,
      });
      return opts.some((o) => o.remaining > 0);
    }),
  );
  const hasPencairan = pencairanChecks.some(Boolean);

  return (
    <div className="space-y-4">
      <h1 className="text-center text-2xl font-bold uppercase tracking-wide text-[var(--ink)]">
        Upload bukti
      </h1>
      <p className="text-center text-sm text-[var(--ink-muted)]">
        Foto nota, isi nominal, pilih keterangan, lalu simpan.
      </p>
      <Card>
        <MandorUploadForm
          projects={projects}
          defaultProjectId={defaultProjectId}
          hasPencairan={hasPencairan}
        />
      </Card>
    </div>
  );
}
