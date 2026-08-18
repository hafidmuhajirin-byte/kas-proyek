"use client";

import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { formatFileSize } from "@/lib/compress-image";
import {
  SITE_VIDEO_MAX_DURATION_SEC,
  SITE_VIDEO_MAX_SOURCE_BYTES,
  SITE_VIDEO_MAX_TOTAL_SEC,
  looksLikeVideo,
} from "@/lib/site-video";
import { btnSecondaryClass } from "@/components/ui";

export type QueuedSiteVideo = {
  file: File;
  previewUrl: string;
  durationSec: number;
};

function FilePickButton({
  label,
  disabled,
  accept,
  capture,
  onChange,
}: {
  label: ReactNode;
  disabled?: boolean;
  accept: string;
  capture?: boolean | "user" | "environment";
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const autoId = useId().replace(/:/g, "");
  const id = `site-video-pick-${autoId}`;
  return (
    <label
      htmlFor={id}
      className={`${btnSecondaryClass} relative min-h-12 flex-1 cursor-pointer overflow-hidden sm:flex-none ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <span className="pointer-events-none">{label}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        {...(capture ? { capture } : {})}
        disabled={disabled}
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        style={{ fontSize: "16px" }}
      />
    </label>
  );
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => {
      if (video.duration === Infinity || Number.isNaN(video.duration)) {
        video.currentTime = 1e10;
        video.ontimeupdate = () => {
          video.ontimeupdate = null;
          const d = video.duration;
          cleanup();
          if (!Number.isFinite(d) || d <= 0) {
            reject(new Error("Tidak bisa membaca durasi video."));
            return;
          }
          resolve(d);
        };
        return;
      }
      const d = video.duration;
      cleanup();
      resolve(d);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Gagal membaca video."));
    };
    video.src = url;
  });
}

export function SiteVideoCapture({
  value,
  onChange,
  disabled,
}: {
  value: QueuedSiteVideo | null;
  onChange: (next: QueuedSiteVideo | null) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!picked) return;
    setError(null);
    if (!looksLikeVideo(picked)) {
      setError("File bukan video.");
      return;
    }
    if (picked.size > SITE_VIDEO_MAX_SOURCE_BYTES) {
      setError("Ukuran video maksimal 40 MB. Rekam maksimal 1 menit.");
      return;
    }
    setBusy(true);
    try {
      const duration = await readVideoDuration(picked);
      if (duration > SITE_VIDEO_MAX_DURATION_SEC + 0.5) {
        setError("Potong/rekam ulang, maksimal 1 menit.");
        onChange(null);
        return;
      }
      if (value) URL.revokeObjectURL(value.previewUrl);
      onChange({
        file: picked,
        previewUrl: URL.createObjectURL(picked),
        durationSec: Math.max(1, Math.round(duration)),
      });
    } catch {
      setError("Gagal membaca video. Coba rekam ulang.");
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FilePickButton
          label="Ambil video"
          disabled={disabled || busy}
          accept="video/*"
          capture="environment"
          onChange={(e) => void onPick(e)}
        />
        <FilePickButton
          label="Video dari galeri"
          disabled={disabled || busy}
          accept="video/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          onChange={(e) => void onPick(e)}
        />
        {value ? (
          <button
            type="button"
            className={`${btnSecondaryClass} flex-1 text-[var(--rose-ink)] sm:flex-none`}
            disabled={disabled || busy}
            onClick={() => {
              URL.revokeObjectURL(value.previewUrl);
              onChange(null);
              setError(null);
            }}
          >
            Hapus
          </button>
        ) : null}
      </div>
      <p className="text-xs text-[var(--ink-faint)]">
        Maks 1 menit per video. Boleh beberapa klip, total {SITE_VIDEO_MAX_TOTAL_SEC / 60} menit per proyek.
      </p>
      {busy ? (
        <p className="text-sm text-[var(--ink-faint)]">Membaca video…</p>
      ) : null}
      {error ? <p className="text-sm text-[var(--rose-ink)]">{error}</p> : null}
      {value ? (
        <div className="space-y-1">
          <video
            ref={previewRef}
            src={value.previewUrl}
            controls
            playsInline
            className="max-h-56 w-full rounded-lg border border-[var(--line)] bg-black"
          />
          <p className="text-xs text-[var(--ink-faint)]">
            Durasi ±{value.durationSec} detik · {formatFileSize(value.file.size)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
