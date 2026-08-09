import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { redirect } from "next/navigation";
import { isMandor, isOwner, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeleteSitePhotoButton } from "@/components/DeleteSitePhotoButton";
import { FotoProyekProjectFilter } from "@/components/FotoProyekProjectFilter";
import { EmptyState } from "@/components/ui";

export default async function FotoProyekPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireSession();
  if (isMandor(user)) redirect("/mandor");
  const owner = isOwner(user);

  const params = await searchParams;

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const projectId =
    params.projectId && projects.some((p) => p.id === params.projectId)
      ? params.projectId
      : undefined;

  const photos = await prisma.projectSitePhoto.findMany({
    where: projectId ? { projectId } : undefined,
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

  const returnTo = projectId
    ? `/foto-proyek?projectId=${projectId}`
    : "/foto-proyek";

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl text-[var(--ink)] sm:text-3xl">
        Foto Proyek
      </h1>

      <FotoProyekProjectFilter projects={projects} projectId={projectId} />

      {photos.length === 0 ? (
        <EmptyState message="Belum ada foto." />
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
