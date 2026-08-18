"use client";

import { useTransition } from "react";
import { deleteSitePhotoAction } from "@/lib/actions/mandor-lokasi";
import { btnDangerClass } from "@/components/ui";

export function DeleteSitePhotoButton({
  photoId,
  returnTo = "/foto-proyek",
}: {
  photoId: string;
  returnTo?: string;
}) {
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = window.confirm(
      "Hapus foto ini? Tindakan tidak bisa dibatalkan.",
    );
    if (!ok) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => {
      void deleteSitePhotoAction(fd);
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={photoId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        disabled={pending}
        className={`${btnDangerClass} min-h-12 w-full text-base`}
      >
        {pending ? "Menghapus…" : "Hapus foto"}
      </button>
    </form>
  );
}
