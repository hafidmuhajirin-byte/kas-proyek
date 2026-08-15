import { redirect } from "next/navigation";
import {
  getAccessibleProjectIds,
  isAdmFoto,
  isMandorWorker,
  requireSession,
} from "@/lib/auth";
import { getPencairanOptionsForProject } from "@/lib/mandor-pencairan";
import { prisma } from "@/lib/prisma";
import {
  MandorLockedProjectHeader,
  MandorProjectPicker,
} from "@/components/MandorProjectPicker";
import { MandorUploadForm } from "@/components/MandorUploadForm";
import { Card } from "@/components/ui";

export default async function MandorUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireSession();
  if (isAdmFoto(user)) redirect("/mandor/lokasi");
  if (!isMandorWorker(user)) redirect("/dashboard");

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

  const projectId =
    params.projectId && ids.includes(params.projectId)
      ? params.projectId
      : undefined;

  // Langkah 1: pilih proyek dulu
  if (!projectId) {
    return (
      <MandorProjectPicker
        title="Upload bukti"
        hint="Pilih proyek dulu, baru foto/unggah nota."
        projects={projects}
        hrefFor={(id) => `/mandor/upload?projectId=${encodeURIComponent(id)}`}
      />
    );
  }

  const project = projects.find((p) => p.id === projectId);
  if (!project) redirect("/mandor/upload");

  const pencairanOpts = await getPencairanOptionsForProject(project.id, {
    mandorId: user.id,
  });
  const hasPencairan = pencairanOpts.some((o) => o.remaining > 0);

  return (
    <div className="space-y-4">
      <MandorLockedProjectHeader
        projectName={project.name}
        homeHref="/mandor"
        homeLabel="Home"
      />

      <Card>
        <MandorUploadForm
          projectId={project.id}
          projectName={project.name}
          hasPencairan={hasPencairan}
        />
      </Card>
    </div>
  );
}
