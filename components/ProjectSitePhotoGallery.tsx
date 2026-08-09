import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { EmptyState } from "@/components/ui";

export type SitePhotoRow = {
  id: string;
  photoUrl: string;
  caption: string | null;
  takenAt: Date;
  latitude: number | null;
  longitude: number | null;
  createdByName: string;
};

export function ProjectSitePhotoGallery({ photos }: { photos: SitePhotoRow[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-serif text-xl text-[var(--ink)]">Foto Lokasi</h3>
        <p className="text-sm text-[var(--ink-faint)]">
          Foto lapangan dari Mandor (disimpan di server aplikasi).
        </p>
      </div>

      {photos.length === 0 ? (
        <EmptyState message="Belum ada foto lokasi." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-lg border border-[var(--line-soft)] bg-[#fffcf7]"
            >
              <a href={photo.photoUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photoUrl}
                  alt={photo.caption || "Foto lokasi"}
                  className="h-44 w-full object-cover"
                />
              </a>
              <div className="space-y-1 px-3 py-2 text-sm">
                <p className="text-[var(--ink-faint)]">
                  {format(photo.takenAt, "d MMM yyyy", { locale: localeId })}
                  {" · "}
                  {photo.createdByName}
                </p>
                {photo.caption ? (
                  <p className="text-[var(--ink)]">{photo.caption}</p>
                ) : null}
                <div className="flex flex-wrap gap-3 text-xs">
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
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
