import { deleteSitePhotoAction } from "@/lib/actions/mandor-lokasi";
import { btnDangerClass } from "@/components/ui";

export function DeleteSitePhotoButton({
  photoId,
  returnTo = "/foto-proyek",
}: {
  photoId: string;
  returnTo?: string;
}) {
  return (
    <form action={deleteSitePhotoAction}>
      <input type="hidden" name="id" value={photoId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={`${btnDangerClass} w-full`}>
        Hapus foto
      </button>
    </form>
  );
}
