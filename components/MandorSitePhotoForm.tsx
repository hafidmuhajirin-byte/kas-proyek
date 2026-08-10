"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  revalidateSitePhotosAction,
  uploadSitePhotosBatchAction,
} from "@/lib/actions/mandor-lokasi";
import {
  MAX_SITE_PHOTOS,
  MAX_UPLOAD_PER_CLICK,
  SitePhotoMultiCapture,
  type QueuedSitePhoto,
} from "@/components/SitePhotoMultiCapture";
import {
  Alert,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";

type ProjectOption = { id: string; name: string };

const UPLOAD_BATCH = 5;

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function MandorSitePhotoForm({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects[0]?.id ?? "",
  );
  const [photoDate, setPhotoDate] = useState(todayYmd);
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<QueuedSitePhoto[]>([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [gpsStatus, setGpsStatus] = useState<
    "idle" | "loading" | "ok" | "denied" | "unavailable"
  >("idle");

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }
    // Tunda GPS setelah paint pertama — jangan blok loading halaman di HP
    const timer = window.setTimeout(() => {
      setGpsStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(String(pos.coords.latitude));
          setLongitude(String(pos.coords.longitude));
          setGpsStatus("ok");
        },
        () => {
          setLatitude("");
          setLongitude("");
          setGpsStatus("denied");
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (photos.length === 0 || pending) return;

    // Ambil maksimal 20 per klik; sisa antrean tetap untuk unggah berikutnya.
    const toUpload = photos.slice(0, MAX_UPLOAD_PER_CLICK);
    const remaining = photos.slice(MAX_UPLOAD_PER_CLICK);

    setPending(true);
    setError(null);
    setSuccess(null);

    let uploaded = 0;
    const total = toUpload.length;
    const batches = Math.ceil(total / UPLOAD_BATCH);
    const doneIds = new Set<string>();

    try {
      for (let b = 0; b < batches; b++) {
        const slice = toUpload.slice(b * UPLOAD_BATCH, (b + 1) * UPLOAD_BATCH);
        setUploadProgress(
          `${Math.min((b + 1) * UPLOAD_BATCH, total)}/${total}`,
        );

        // FormData dari state — jangan dari DOM form (bisa putus saat refresh).
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("date", photoDate);
        fd.set("caption", caption);
        fd.set("latitude", latitude);
        fd.set("longitude", longitude);
        // Skip revalidate di batch tengah & batch terakhir bila masih ada sisa
        // (revalidate dipanggil sekali di akhir).
        fd.set("skipRevalidate", "1");
        for (const item of slice) {
          fd.append("photos", item.file);
          fd.append("sourceNames", item.sourceName);
        }

        const result = await uploadSitePhotosBatchAction({}, fd);
        if (result.error) {
          // Hapus yang sudah sukses dari kotak; sisanya (gagal + belum) tetap.
          const keep = photos.filter((p) => !doneIds.has(p.id));
          setPhotos(keep);
          setError(
            uploaded > 0
              ? `${result.error} (${uploaded} tersimpan, sisa di kotak)`
              : result.error,
          );
          return;
        }
        uploaded += result.count ?? slice.length;
        for (const item of slice) doneIds.add(item.id);
      }

      // Yang sudah terunggah hilang dari kotak; sisa (jika >20) tetap.
      for (const item of toUpload) {
        URL.revokeObjectURL(item.previewUrl);
      }
      setPhotos(remaining);
      setPhotoDate(todayYmd());
      setSuccess(
        remaining.length > 0
          ? `${uploaded} tersimpan. ${remaining.length} masih di kotak — unggah lagi.`
          : `${uploaded} foto tersimpan.`,
      );

      await revalidateSitePhotosAction(projectId);
      router.refresh();
    } catch {
      const keep = photos.filter((p) => !doneIds.has(p.id));
      setPhotos(keep);
      setError(
        uploaded > 0
          ? `${uploaded} tersimpan. Sisa masih di kotak — unggah lagi.`
          : "Gagal mengunggah. Coba lagi.",
      );
    } finally {
      setPending(false);
      setUploadProgress(null);
    }
  }

  const uploadCount = Math.min(photos.length, MAX_UPLOAD_PER_CLICK);

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <Field label="Proyek" htmlFor="projectId">
        <select
          id="projectId"
          name="projectId"
          className={inputClass}
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={pending}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tanggal foto" htmlFor="date">
        <input
          id="date"
          name="date"
          type="date"
          className={inputClass}
          required
          value={photoDate}
          onChange={(e) => setPhotoDate(e.target.value)}
          disabled={pending}
        />
      </Field>

      <Field label="Catatan" htmlFor="caption">
        <input
          id="caption"
          name="caption"
          className={inputClass}
          placeholder="Opsional"
          maxLength={500}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={pending}
        />
      </Field>

      <Field label="Foto">
        <SitePhotoMultiCapture
          items={photos}
          onChange={setPhotos}
          latitude={latitude}
          longitude={longitude}
          photoDate={photoDate}
        />
      </Field>

      {gpsStatus === "denied" || gpsStatus === "unavailable" ? (
        <p className="text-xs text-[var(--ink-faint)]">Tanpa GPS</p>
      ) : null}

      {uploadProgress ? (
        <p className="text-center text-sm font-medium text-teal-900">
          {uploadProgress}
        </p>
      ) : null}

      <button
        type="submit"
        className={`${btnPrimaryClass} w-full min-h-14 text-base !bg-teal-700 hover:!bg-teal-800`}
        disabled={pending || photos.length === 0}
      >
        {pending
          ? uploadProgress ?? "…"
          : photos.length > MAX_UPLOAD_PER_CLICK
            ? `Unggah ${uploadCount} foto (${photos.length - uploadCount} nanti)`
            : photos.length > 1
              ? `Unggah ${photos.length} foto`
              : "Unggah foto"}
      </button>
    </form>
  );
}
