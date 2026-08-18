"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SITE_VIDEO_MAX_TOTAL_SEC } from "@/lib/site-video";
import {
  SiteVideoCapture,
  type QueuedSiteVideo,
} from "@/components/SiteVideoCapture";
import {
  Alert,
  btnPrimaryClass,
  Field,
  inputClass,
} from "@/components/ui";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function MandorSiteVideoForm({
  projectId,
  projectName,
  usedDurationSec,
}: {
  projectId: string;
  projectName: string;
  usedDurationSec: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [videoDate, setVideoDate] = useState(todayYmd);
  const [caption, setCaption] = useState("");
  const [video, setVideo] = useState<QueuedSiteVideo | null>(null);

  const remain = Math.max(0, SITE_VIDEO_MAX_TOTAL_SEC - usedDurationSec);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!video || pending) return;
    if (remain <= 0) {
      setError("Total video proyek sudah 5 menit.");
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);
    setStatus("Mengunggah…");

    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("date", videoDate);
    fd.set("caption", caption);
    fd.set("video", video.file, video.file.name || "video.mp4");

    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => {
        setStatus("Mengompres video…");
      }, 1200);
      const res = await fetch("/api/site-videos", {
        method: "POST",
        body: fd,
        signal: ctrl.signal,
      });
      window.clearTimeout(timer);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Gagal mengunggah video.");
        return;
      }
      URL.revokeObjectURL(video.previewUrl);
      setVideo(null);
      setCaption("");
      setVideoDate(todayYmd());
      setSuccess("Video tersimpan.");
      router.refresh();
    } catch {
      setError("Gagal mengunggah. Cek koneksi lalu coba lagi.");
    } finally {
      setPending(false);
      setStatus(null);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <p className="rounded-lg border border-teal-200/80 bg-teal-50/70 px-3 py-2 text-sm text-teal-950">
        Video untuk: <span className="font-medium">{projectName}</span>
        <span className="block text-xs text-teal-900/80">
          Kuota {usedDurationSec}/{SITE_VIDEO_MAX_TOTAL_SEC} detik (sisa {remain} detik)
        </span>
      </p>

      <Field label="Tanggal video" htmlFor="video-date">
        <input
          id="video-date"
          type="date"
          className={inputClass}
          required
          value={videoDate}
          onChange={(e) => setVideoDate(e.target.value)}
          disabled={pending}
        />
      </Field>

      <Field label="Catatan" htmlFor="video-caption">
        <input
          id="video-caption"
          className={inputClass}
          placeholder="Opsional"
          maxLength={500}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={pending}
        />
      </Field>

      <Field label="Video (maks 1 menit)">
        <SiteVideoCapture
          value={video}
          onChange={setVideo}
          disabled={pending || remain <= 0}
        />
      </Field>

      <button
        type="submit"
        className={`${btnPrimaryClass} w-full min-h-14 text-base !bg-teal-700 hover:!bg-teal-800`}
        disabled={pending || !video || remain <= 0}
      >
        {pending ? status ?? "Mengunggah…" : "Unggah video"}
      </button>
    </form>
  );
}
