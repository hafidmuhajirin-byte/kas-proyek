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
import { MandorSiteVideoForm } from "@/components/MandorSiteVideoForm";
import { AdmFotoVideoReminder } from "@/components/AdmFotoVideoReminder";
import { Card } from "@/components/ui";
import { jakartaDayOfMonth, jakartaMonthRange } from "@/lib/jakarta-time";

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

  const admFoto = isAdmFoto(user);
  let reminderProjects: { id: string; name: string }[] = [];
  if (admFoto && jakartaDayOfMonth() === 20) {
    const { start, end } = jakartaMonthRange();
    const uploaded = await prisma.projectSiteVideo.findMany({
      where: {
        projectId: { in: ids },
        takenAt: { gte: start, lt: end },
      },
      select: { projectId: true },
    });
    const done = new Set(uploaded.map((v) => v.projectId));
    reminderProjects = projects.filter((p) => !done.has(p.id));
  }

  const reminderBanner =
    admFoto && reminderProjects.length > 0 ? (
      <AdmFotoVideoReminder projects={reminderProjects} />
    ) : null;

  // Langkah 1: pilih proyek dulu
  if (!projectId) {
    return (
      <div className="space-y-4">
        {reminderBanner}
        <MandorProjectPicker
          title="Foto proyek"
          hint="Pilih proyek dulu, baru ambil/unggah foto."
          projects={projects}
          hrefFor={(id) => `/mandor/lokasi?projectId=${encodeURIComponent(id)}`}
        />
      </div>
    );
  }

  const project = projects.find((p) => p.id === projectId);
  if (!project) redirect("/mandor/lokasi");

  const recent = await prisma.projectSitePhoto.findMany({
    where: { projectId },
    orderBy: { takenAt: "desc" },
    take: 60,
    select: {
      id: true,
      photoUrl: true,
      caption: true,
      takenAt: true,
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });

  const recentVideos = admFoto
    ? await prisma.projectSiteVideo.findMany({
        where: { projectId },
        orderBy: { takenAt: "desc" },
        take: 20,
        select: {
          id: true,
          videoUrl: true,
          caption: true,
          takenAt: true,
          durationSec: true,
          createdBy: { select: { name: true } },
        },
      })
    : [];

  const usedVideo = admFoto
    ? await prisma.projectSiteVideo.aggregate({
        where: { projectId },
        _sum: { durationSec: true },
      })
    : { _sum: { durationSec: 0 } };

  const homeHref = admFoto ? "/mandor/lokasi" : "/mandor";

  return (
    <div className="space-y-5">
      {reminderBanner}
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

      {admFoto ? (
        <Card>
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Video</h2>
          <MandorSiteVideoForm
            projectId={project.id}
            projectName={project.name}
            usedDurationSec={usedVideo._sum.durationSec ?? 0}
          />
        </Card>
      ) : null}

      {admFoto && recentVideos.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-serif text-xl text-[var(--ink)]">
            Video proyek · {project.name}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentVideos.map((video) => (
              <li
                key={video.id}
                className="overflow-hidden rounded border border-[var(--line-soft)] bg-[#fffcf7]"
              >
                <video
                  src={video.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full bg-black"
                />
                <p className="truncate px-2 py-1 text-[11px] text-[var(--ink-faint)]">
                  {format(video.takenAt, "d/M", { locale: localeId })}
                  {` · ${video.durationSec} dtk`}
                  {video.createdBy?.name ? ` · ${video.createdBy.name}` : ""}
                  {video.caption ? ` · ${video.caption}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-serif text-xl text-[var(--ink)]">
          Foto proyek · {project.name}
        </h2>
        <p className="text-xs text-[var(--ink-faint)]">
          Semua foto Mandor & ADM Foto di proyek ini.
        </p>
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
                  {photo.createdBy?.name
                    ? ` · ${photo.createdBy.name}`
                    : ""}
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
