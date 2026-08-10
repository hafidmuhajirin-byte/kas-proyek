import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { redirect } from "next/navigation";
import {
  getAccessibleProjectIds,
  isAdmFoto,
  isMandorLike,
  requireSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MandorLockedProjectHeader,
  MandorProjectPicker,
} from "@/components/MandorProjectPicker";
import { MandorSitePhotoForm } from "@/components/MandorSitePhotoForm";
import { Card } from "@/components/ui";

export default async function MandorLokasiPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; ok?: string; n?: string }>;
}) {
  const user = await requireSession();
  if (!isMandorLike(user)) redirect("/dashboard");

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
        title="Foto proyek"
        hint="Pilih proyek dulu, baru ambil/unggah foto."
        projects={projects}
        hrefFor={(id) => `/mandor/lokasi?projectId=${encodeURIComponent(id)}`}
      />
    );
  }

  const project = projects.find((p) => p.id === projectId);
  if (!project) redirect("/mandor/lokasi");

  const recent = await prisma.projectSitePhoto.findMany({
    where: {
      projectId,
      createdById: user.id,
    },
    orderBy: { takenAt: "desc" },
    take: 40,
    select: {
      id: true,
      photoUrl: true,
      caption: true,
      takenAt: true,
    },
  });

  const homeHref = isAdmFoto(user) ? "/mandor/lokasi" : "/mandor";

  return (
    <div className="space-y-5">
      <MandorLockedProjectHeader
        projectName={project.name}
        homeHref={homeHref}
        homeLabel="Home"
      />

      {params.ok === "1" ? (
        <p className="text-sm text-teal-900">
          {params.n && Number(params.n) > 1
            ? `${params.n} foto tersimpan.`
            : "Tersimpan."}
        </p>
      ) : null}

      <Card>
        <MandorSitePhotoForm
          projectId={project.id}
          projectName={project.name}
        />
      </Card>

      <section className="space-y-2">
        <h2 className="font-serif text-xl text-[var(--ink)]">
          Terbaru · {project.name}
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)]">
            Belum ada foto di proyek ini.
          </p>
        ) : (
          <ul className="grid grid-cols-4 gap-1.5">
            {recent.map((photo) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded border border-[var(--line-soft)] bg-[#fffcf7]"
              >
                <a href={photo.photoUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.photoUrl}
                    alt={photo.caption || "Foto proyek"}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </a>
                <p className="truncate px-1 py-0.5 text-[9px] leading-tight text-[var(--ink-faint)]">
                  {format(photo.takenAt, "d/M", { locale: localeId })}
                  {photo.caption ? ` · ${photo.caption}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
