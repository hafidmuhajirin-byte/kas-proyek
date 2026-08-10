"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  compressImageFileSquare,
  formatFileSize,
} from "@/lib/compress-image";
import { sourceNameFromFile } from "@/lib/site-photo-name";
import { btnSecondaryClass } from "@/components/ui";

export type QueuedSitePhoto = {
  id: string;
  file: File;
  previewUrl: string;
  /** Nama sumber unik per proyek (cegah dobel). */
  sourceName: string;
};

/** Kapasitas kotak antrean di HP (boleh lebih dari sekali unggah). */
export const MAX_SITE_PHOTOS = 40;
/** Maks foto yang dikirim per klik Unggah (sisa tetap di kotak). */
export const MAX_UPLOAD_PER_CLICK = 20;
/** Lebih kecil = lebih ringan di HP (masih cukup jelas untuk dokumentasi). */
const SITE_MAX_EDGE = 800;
const SITE_MAX_BYTES = 180 * 1024;

function yieldToUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function FilePickButton({
  label,
  disabled,
  accept,
  capture,
  multiple,
  onChange,
}: {
  label: ReactNode;
  disabled?: boolean;
  accept: string;
  capture?: boolean | "user" | "environment";
  multiple?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const autoId = useId().replace(/:/g, "");
  const id = `site-photo-pick-${autoId}`;

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
        multiple={multiple}
        {...(capture ? { capture } : {})}
        disabled={disabled}
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        style={{ fontSize: "16px" }}
      />
    </label>
  );
}

function stampAtFromDate(photoDate: string): Date {
  const d = new Date(`${photoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return new Date();
  const now = new Date();
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return d;
}

export function SitePhotoMultiCapture({
  items,
  onChange,
  latitude,
  longitude,
  photoDate,
}: {
  items: QueuedSitePhoto[];
  onChange: (next: QueuedSitePhoto[]) => void;
  latitude?: string;
  longitude?: string;
  /** YYYY-MM-DD — dipakai stempel waktu di foto */
  photoDate: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useTimestamp, setUseTimestamp] = useState(true);
  const stampRef = useRef(useTimestamp);
  stampRef.current = useTimestamp;
  const dateRef = useRef(photoDate);
  dateRef.current = photoDate;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const latNum =
    latitude && latitude !== "" ? Number(latitude) : null;
  const lngNum =
    longitude && longitude !== "" ? Number(longitude) : null;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  async function addFiles(list: FileList | null, fromCamera: boolean) {
    if (!list?.length) return;
    setError(null);
    const base = itemsRef.current;
    const room = MAX_SITE_PHOTOS - base.length;
    if (room <= 0) {
      setError(`Maks. ${MAX_SITE_PHOTOS} foto.`);
      return;
    }

    const seen = new Set(base.map((i) => i.sourceName));
    const picked = Array.from(list).slice(0, room);
    setBusy(true);
    const added: QueuedSitePhoto[] = [];
    let skippedDup = 0;
    try {
      for (let i = 0; i < picked.length; i++) {
        const raw = picked[i]!;
        if (!raw.type.startsWith("image/") && raw.type !== "") {
          continue;
        }

        const sourceName = await sourceNameFromFile(raw, fromCamera);
        if (!sourceName) {
          skippedDup += 1;
          continue;
        }
        if (seen.has(sourceName)) {
          skippedDup += 1;
          continue;
        }
        seen.add(sourceName);

        setProgress(`${i + 1}/${picked.length}`);
        try {
          const withStamp = stampRef.current;
          const file = await compressImageFileSquare(raw, {
            maxEdge: SITE_MAX_EDGE,
            maxBytes: SITE_MAX_BYTES,
            quality: 0.65,
            stamp: withStamp
              ? {
                  at: stampAtFromDate(dateRef.current),
                  latitude:
                    latNum != null && Number.isFinite(latNum) ? latNum : null,
                  longitude:
                    lngNum != null && Number.isFinite(lngNum) ? lngNum : null,
                }
              : false,
          });
          const item: QueuedSitePhoto = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            sourceName,
          };
          added.push(item);
          onChange([...base, ...added]);
        } catch {
          seen.delete(sourceName);
        }
        await yieldToUi();
      }

      if (added.length === 0) {
        setError(
          skippedDup > 0
            ? "Foto dengan nama sama sudah ada di daftar."
            : "Tidak ada foto yang bisa ditambahkan.",
        );
        return;
      }
      if (skippedDup > 0) {
        setError(`${skippedDup} foto dilewati (nama sama).`);
      } else if (list.length > room) {
        setError(`Maks. ${MAX_SITE_PHOTOS} foto.`);
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function removeOne(id: string) {
    const target = items.find((i) => i.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(items.filter((i) => i.id !== id));
  }

  function clearAll() {
    for (const item of items) URL.revokeObjectURL(item.previewUrl);
    onChange([]);
  }

  return (
    <div className="space-y-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 accent-teal-700"
          checked={useTimestamp}
          disabled={busy}
          onChange={(e) => setUseTimestamp(e.target.checked)}
        />
        <span className="font-medium">Stempel waktu</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <FilePickButton
          label="Ambil foto"
          disabled={busy || items.length >= MAX_SITE_PHOTOS}
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            void addFiles(e.target.files, true);
            e.target.value = "";
          }}
        />
        <FilePickButton
          label={`Galeri (max ${MAX_SITE_PHOTOS})`}
          disabled={busy || items.length >= MAX_SITE_PHOTOS}
          accept="image/*"
          multiple
          onChange={(e) => {
            void addFiles(e.target.files, false);
            e.target.value = "";
          }}
        />
        {items.length > 0 ? (
          <button
            type="button"
            className={`${btnSecondaryClass} text-[var(--rose-ink)]`}
            disabled={busy}
            onClick={clearAll}
          >
            Hapus semua
          </button>
        ) : null}
      </div>

      {busy ? (
        <p className="text-sm text-[var(--ink-faint)]">{progress ?? "…"}</p>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--rose-ink)]">{error}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-4 gap-1">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="relative overflow-hidden rounded border border-[var(--line-soft)] bg-[#fffcf7]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={`Foto ${index + 1}`}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] leading-none text-white"
                onClick={() => removeOne(item.id)}
              >
                ×
              </button>
              <p className="truncate px-0.5 py-0.5 text-[9px] text-[var(--ink-faint)]">
                {formatFileSize(item.file.size)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <p className="text-sm font-medium text-[var(--ink)]">
          {items.length}/{MAX_SITE_PHOTOS} di kotak
          {items.length > MAX_UPLOAD_PER_CLICK
            ? ` · unggah ${MAX_UPLOAD_PER_CLICK}/klik`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
