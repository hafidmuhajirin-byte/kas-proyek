"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { createSitePhotoAction } from "@/lib/actions/mandor-lokasi";
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

export function MandorSitePhotoForm({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(createSitePhotoAction, {});
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
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (photos.length === 0) return;
    const fd = new FormData(e.currentTarget);
    for (const item of photos) {
      fd.append("photos", item.file);
    }
    formAction(fd);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}

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
        />
      </Field>

      <Field label="Catatan (opsional, untuk semua foto)" htmlFor="caption">
        <input
          id="caption"
          name="caption"
          className={inputClass}
          placeholder="Mis. progress dinding, tapak, dll."
          maxLength={500}
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
            Aktifkan lokasi di browser untuk menyertakan GPS.
          </p>
        ) : gpsStatus === "unavailable" ? (
          <p>GPS tidak tersedia di perangkat ini.</p>
        ) : (
          <p>Koordinat GPS akan diambil saat halaman dibuka.</p>
        )}
      </div>

      <button
        type="submit"
        className={`${btnPrimaryClass} w-full min-h-14 text-base !bg-teal-700 hover:!bg-teal-800`}
        disabled={pending || photos.length === 0}
      >
        {pending
          ? "Mengunggah…"
          : photos.length > 1
            ? `Unggah ${photos.length} foto`
            : "Unggah foto"}
      </button>
    </form>
  );
}
