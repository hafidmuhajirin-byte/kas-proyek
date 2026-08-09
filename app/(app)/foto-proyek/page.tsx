import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { redirect } from "next/navigation";
import { isMandor, isOwner, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteSitePhotoAction } from "@/lib/actions/mandor-lokasi";
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
      takenAt: true,
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

      {/* Filter proyek sederhana */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/foto-proyek"
          className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
            !projectId
              ? "bg-teal-700 font-medium text-white"
              : "bg-[var(--paper-tint)] text-[var(--ink)]"
          }`}
        >
          Semua
        </Link>
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/foto-proyek?projectId=${p.id}`}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
              projectId === p.id
                ? "bg-teal-700 font-medium text-white"
                : "bg-[var(--paper-tint)] text-[var(--ink)]"
            }`}
          >
            {p.name}
          </Link>
        ))}
      </div>

      {photos.length === 0 ? (
        <EmptyState message="Belum ada foto." />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo) => (
            <li key={photo.id} className="min-w-0">
              <a
                href={photo.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg bg-[var(--paper-tint)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photoUrl}
                  alt={photo.caption || photo.project.name}
                  className="aspect-square w-full object-cover"
                />
              </a>
              <div className="mt-1 space-y-0.5 px-0.5">
                <p className="truncate text-xs font-medium text-[var(--ink)]">
                  {photo.project.name}
                </p>
                <p className="text-[11px] text-[var(--ink-faint)]">
                  {format(photo.createdAt, "d MMM yyyy · HH:mm", {
                    locale: localeId,
                  })}
                </p>
                {owner ? (
                  <form action={deleteSitePhotoAction}>
                    <input type="hidden" name="id" value={photo.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button
                      type="submit"
                      className="text-[11px] text-[var(--rose-ink)] underline"
                    >
                      Hapus
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
