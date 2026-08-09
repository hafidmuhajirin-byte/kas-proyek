"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadSitePhotosBatchAction } from "@/lib/actions/mandor-lokasi";
import {
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

export function MandorSitePhotoForm({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects[0]?.id ?? "",
  );
  const [photos, setPhotos] = useState<QueuedSitePhoto[]>([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [gpsStatus, setGpsStatus] = useState<
    "idle" | "loading" | "ok" | "denied" | "unavailable"
  >("idle");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }
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
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120_000 },
    );
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (photos.length === 0 || pending) return;

    const form = e.currentTarget;
    setPending(true);
    setError(null);

    let uploaded = 0;
    const total = photos.length;
    const batches = Math.ceil(total / UPLOAD_BATCH);

    try {
      for (let b = 0; b < batches; b++) {
        const slice = photos.slice(b * UPLOAD_BATCH, (b + 1) * UPLOAD_BATCH);
        setUploadProgress(
          `Mengunggah ${Math.min((b + 1) * UPLOAD_BATCH, total)}/${total}…`,
        );

        const fd = new FormData(form);
        fd.delete("photos");
        for (const item of slice) {
          fd.append("photos", item.file);
        }

        const result = await uploadSitePhotosBatchAction({}, fd);
        if (result.error) {
          setError(
            uploaded > 0
              ? `${result.error} (${uploaded} foto sudah tersimpan.)`
              : result.error,
          );
          return;
        }
        uploaded += result.count ?? slice.length;
      }

      for (const item of photos) {
        URL.revokeObjectURL(item.previewUrl);
      }
      setPhotos([]);
      router.push(
        `/mandor/lokasi?projectId=${encodeURIComponent(projectId)}&ok=1&n=${uploaded}`,
      );
      router.refresh();
    } catch {
      setError(
        uploaded > 0
          ? `Koneksi terputus. ${uploaded} foto mungkin sudah tersimpan — cek daftar di bawah.`
          : "Gagal mengunggah. Coba lagi dengan lebih sedikit foto.",
      );
    } finally {
      setPending(false);
      setUploadProgress(null);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}

      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />

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
          defaultValue={today}
          disabled={pending}
        />
      </Field>

      <Field label="Catatan (opsional, untuk semua foto)" htmlFor="caption">
        <input
          id="caption"
          name="caption"
          className={inputClass}
          placeholder="Mis. progress dinding, tapak, dll."
          maxLength={500}
          disabled={pending}
        />
      </Field>

      <Field label="Foto lokasi (wajib, 1:1)">
        <SitePhotoMultiCapture
          items={photos}
          onChange={setPhotos}
          latitude={latitude}
          longitude={longitude}
        />
      </Field>

      <div className="rounded-lg border border-teal-200/80 bg-teal-50/70 px-3 py-2 text-sm text-teal-950">
        {gpsStatus === "loading" ? (
          <p>Mengambil koordinat GPS…</p>
        ) : gpsStatus === "ok" ? (
          <p>
            GPS: {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
          </p>
        ) : gpsStatus === "denied" ? (
          <p>
            Izin lokasi ditolak — foto tetap bisa disimpan tanpa koordinat.
          </p>
        ) : gpsStatus === "unavailable" ? (
          <p>GPS tidak tersedia di perangkat ini.</p>
        ) : (
          <p>Koordinat GPS akan diambil saat halaman dibuka.</p>
        )}
      </div>

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
          ? uploadProgress ?? "Mengunggah…"
          : photos.length > 1
            ? `Unggah ${photos.length} foto`
            : "Unggah foto"}
      </button>
    </form>
  );
}
