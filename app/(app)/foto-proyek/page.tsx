import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { redirect } from "next/navigation";
import {
  getAccessibleProjectIds,
  homePathForUser,
  isAdmin,
  isAdminProyek,
  isLpjViewer,
  isMandorLike,
  isOwner,
  requireSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeleteSitePhotoButton } from "@/components/DeleteSitePhotoButton";
import { DeleteSiteVideoButton } from "@/components/DeleteSiteVideoButton";
import { FotoProyekDownload } from "@/components/FotoProyekDownload";
import { FotoProyekVideoDownload } from "@/components/FotoProyekVideoDownload";
import { FotoProyekProjectFilter } from "@/components/FotoProyekProjectFilter";
import { EmptyState, btnSecondaryClass } from "@/components/ui";

export default async function FotoProyekPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireSession();
  if (isMandorLike(user)) redirect(homePathForUser(user));
  const owner = isOwner(user);
  const adminOk = isAdmin(user);
  const adminProyek = isAdminProyek(user);
  const lpjViewer = isLpjViewer(user);
  const canDownloadVideo = owner || adminOk || adminProyek;

  const params = await searchParams;
  const accessible = await getAccessibleProjectIds(user);

  const projects = await prisma.project.findMany({
    where: accessible === "all" ? undefined : { id: { in: accessible } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const projectId =
    params.projectId && projects.some((p) => p.id === params.projectId)
      ? params.projectId
      : (adminProyek || lpjViewer) && projects.length === 1
        ? projects[0]!.id
        : undefined;

  const photoWhere = projectId
    ? { projectId }
    : accessible === "all"
      ? undefined
      : { projectId: { in: accessible } };

  const photos = await prisma.projectSitePhoto.findMany({
    where: photoWhere,
    orderBy: [{ createdAt: "desc" }, { takenAt: "desc" }],
    take: 300,
    select: {
      id: true,
      photoUrl: true,
      caption: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
    },
  });

  const videos = await prisma.projectSiteVideo.findMany({
    where: photoWhere,
    orderBy: [{ createdAt: "desc" }, { takenAt: "desc" }],
    take: 100,
    select: {
      id: true,
      videoUrl: true,
      caption: true,
      durationSec: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
    },
  });

  const returnTo = projectId
    ? `/foto-proyek?projectId=${projectId}`
    : "/foto-proyek";

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl text-[var(--ink)] sm:text-3xl">
        Foto Proyek
      </h1>

      <FotoProyekProjectFilter projects={projects} projectId={projectId} />

      {projectId ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FotoProyekDownload projectId={projectId} />
          {canDownloadVideo ? (
            <FotoProyekVideoDownload projectId={projectId} />
          ) : null}
        </div>
      ) : null}

      {videos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-serif text-xl text-[var(--ink)]">Video</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {videos.map((video) => (
              <li
                key={video.id}
                className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-[#fffcf7]"
              >
                <video
                  src={video.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full bg-black"
                />
                <div className="space-y-2 p-3">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">
                    {video.project.name}
                  </p>
                  <p className="text-xs text-[var(--ink-faint)]">
                    {format(video.createdAt, "d MMM yyyy · HH:mm", {
                      locale: localeId,
                    })}
                    {` · ${video.durationSec} dtk`}
                    {video.caption ? ` · ${video.caption}` : ""}
                  </p>
                  {canDownloadVideo ? (
                    <a
                      href={`/api/foto-proyek/videos/${video.id}/download`}
                      className={`${btnSecondaryClass} inline-flex min-h-11 w-full items-center justify-center`}
                    >
                      Download
                    </a>
                  ) : null}
                  {owner ? (
                    <DeleteSiteVideoButton
                      videoId={video.id}
                      returnTo={returnTo}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {photos.length === 0 ? (
        videos.length === 0 ? (
          <EmptyState message="Belum ada foto atau video." />
        ) : null
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-[#fffcf7]"
            >
              <a
                href={photo.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="block bg-[var(--paper-tint)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photoUrl}
                  alt={photo.caption || photo.project.name}
                  className="aspect-square w-full object-cover"
                />
              </a>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-medium text-[var(--ink)]">
                  {photo.project.name}
                </p>
                <p className="text-xs text-[var(--ink-faint)]">
                  {format(photo.createdAt, "d MMM yyyy · HH:mm", {
                    locale: localeId,
                  })}
                </p>
                {owner ? (
                  <DeleteSitePhotoButton
                    photoId={photo.id}
                    returnTo={returnTo}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
