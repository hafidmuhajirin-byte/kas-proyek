import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAccessibleProjectIds,
  isAdmFoto,
  isMandorLike,
  requireSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const defaultProjectId =
    params.projectId && ids.includes(params.projectId)
      ? params.projectId
      : projects[0]?.id;

  const recent = await prisma.projectSitePhoto.findMany({
    where: {
      projectId: { in: ids },
      createdById: user.id,
    },
    orderBy: { takenAt: "desc" },
    take: 20,
    select: {
      id: true,
      photoUrl: true,
      caption: true,
      takenAt: true,
      latitude: true,
      longitude: true,
      project: { select: { name: true } },
    },
  });

  const admFoto = isAdmFoto(user);

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-2xl text-[var(--ink)]">Foto proyek</h1>

      {params.ok === "1" ? (
        <p className="text-sm text-teal-900">
          {params.n && Number(params.n) > 1
            ? `${params.n} foto tersimpan.`
            : "Tersimpan."}
        </p>
      ) : null}

      <Card>
        <MandorSitePhotoForm
          projects={projects}
          defaultProjectId={defaultProjectId}
        />
      </Card>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-[var(--ink)]">Terbaru</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)]">Belum ada foto.</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((photo) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-lg border border-[var(--line-soft)] bg-[#fffcf7]"
              >
                <a href={photo.photoUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.photoUrl}
                    alt={photo.caption || "Foto proyek"}
                    className="aspect-square w-full object-cover"
                  />
                </a>
                <div className="space-y-1 px-3 py-2 text-sm">
                  <p className="font-medium text-[var(--ink)]">
                    {photo.project.name}
                  </p>
                  <p className="text-[var(--ink-faint)]">
                    {format(photo.takenAt, "d MMM yyyy", { locale: localeId })}
                    {photo.caption ? ` · ${photo.caption}` : ""}
                  </p>
                  {photo.latitude != null && photo.longitude != null ? (
                    <a
                      href={`https://maps.google.com/?q=${photo.latitude},${photo.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-teal-800 underline"
                    >
                      Peta
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!admFoto ? (
        <p className="text-center text-sm">
          <Link href="/mandor" className="text-[var(--accent)] underline">
            Beranda
          </Link>
        </p>
      ) : null}
    </div>
  );
}
