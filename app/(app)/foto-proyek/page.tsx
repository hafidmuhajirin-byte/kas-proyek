import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { redirect } from "next/navigation";
import { isAdmin, isMandor, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  EmptyState,
  PageHeader,
  inputClass,
} from "@/components/ui";

export default async function FotoProyekPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireSession();
  if (isMandor(user)) redirect("/mandor");
  const admin = isAdmin(user);

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
    orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      photoUrl: true,
      caption: true,
      takenAt: true,
      latitude: true,
      longitude: true,
      driveWebViewLink: true,
      project: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Foto Proyek"
        description="Galeri foto lokasi dari Mandor. Klik gambar untuk memperbesar."
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block text-[var(--ink-faint)]">Proyek</span>
            <select
              name="projectId"
              className={inputClass}
              defaultValue={projectId ?? ""}
            >
              <option value="">Semua proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-[#f7f4ee] hover:bg-teal-800"
          >
            Filter
          </button>
        </form>
      </Card>

      {photos.length === 0 ? (
        <EmptyState message="Belum ada foto proyek." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-lg border border-[var(--line-soft)] bg-[#fffcf7]"
            >
              <a href={photo.photoUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photoUrl}
                  alt={photo.caption || photo.project.name}
                  className="h-48 w-full object-cover"
                />
              </a>
              <div className="space-y-1 px-3 py-2 text-sm">
                <p className="font-medium text-[var(--ink)]">
                  <Link
                    href={
                      admin
                        ? `/admin/lpj/${photo.project.id}`
                        : `/projects/${photo.project.id}`
                    }
                    className="hover:underline"
                  >
                    {photo.project.name}
                  </Link>
                </p>
                <p className="text-[var(--ink-faint)]">
                  {format(photo.takenAt, "d MMM yyyy", { locale: localeId })}
                  {" · "}
                  {photo.createdBy.name}
                </p>
                {photo.caption ? (
                  <p className="text-[var(--ink)]">{photo.caption}</p>
                ) : null}
                <div className="flex flex-wrap gap-3 pt-1 text-xs">
                  {photo.latitude != null && photo.longitude != null ? (
                    <a
                      href={`https://maps.google.com/?q=${photo.latitude},${photo.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-800 underline"
                    >
                      Lihat di peta
                    </a>
                  ) : null}
                  {photo.driveWebViewLink ? (
                    <a
                      href={photo.driveWebViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-800 underline"
                    >
                      Buka di Drive
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
