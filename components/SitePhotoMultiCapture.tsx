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
import { btnSecondaryClass } from "@/components/ui";

export type QueuedSitePhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_PHOTOS = 20;
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

export function SitePhotoMultiCapture({
  items,
  onChange,
  latitude,
  longitude,
}: {
  items: QueuedSitePhoto[];
  onChange: (next: QueuedSitePhoto[]) => void;
  latitude?: string;
  longitude?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Stempel waktu/GPS di foto — bisa dicentang atau tidak. */
  const [useTimestamp, setUseTimestamp] = useState(true);
  const stampRef = useRef(useTimestamp);
  stampRef.current = useTimestamp;
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

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const base = itemsRef.current;
    const room = MAX_PHOTOS - base.length;
    if (room <= 0) {
      setError(`Maksimal ${MAX_PHOTOS} foto sekaligus.`);
      return;
    }

    const picked = Array.from(list).slice(0, room);
    setBusy(true);
    const added: QueuedSitePhoto[] = [];
    try {
      for (let i = 0; i < picked.length; i++) {
        const raw = picked[i]!;
        if (!raw.type.startsWith("image/") && raw.type !== "") {
          continue;
        }
        setProgress(`Memproses ${i + 1}/${picked.length}…`);
        try {
          const withStamp = stampRef.current;
          const file = await compressImageFileSquare(raw, {
            maxEdge: SITE_MAX_EDGE,
            maxBytes: SITE_MAX_BYTES,
            quality: 0.65,
            stamp: withStamp
              ? {
                  at: new Date(),
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
          };
          added.push(item);
          onChange([...base, ...added]);
        } catch {
          // skip file gagal
        }
        await yieldToUi();
      }

      if (added.length === 0) {
        setError("Tidak ada foto yang bisa ditambahkan.");
        return;
      }
      if (list.length > room) {
        setError(
          `Hanya ${room} foto lagi yang ditambahkan (batas ${MAX_PHOTOS}).`,
        );
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
      <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-[var(--line-soft)] bg-[#fffcf7] px-3 py-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-teal-700"
          checked={useTimestamp}
          disabled={busy}
          onChange={(e) => setUseTimestamp(e.target.checked)}
        />
        <span className="text-sm text-[var(--ink)]">
          <span className="font-medium">Stempel waktu (timestamp)</span>
          <span className="mt-0.5 block text-xs text-[var(--ink-faint)]">
            {useTimestamp
              ? `Centang aktif — tanggal/jam${latNum != null && lngNum != null ? " + GPS" : ""} ditulis di foto.`
              : "Tidak dicentang — foto tanpa stempel waktu."}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <FilePickButton
          label="Ambil foto"
          disabled={busy || items.length >= MAX_PHOTOS}
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <FilePickButton
          label="Dari galeri"
          disabled={busy || items.length >= MAX_PHOTOS}
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            void addFiles(e.target.files);
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
        <p className="text-sm text-[var(--ink-faint)]">
          {progress ?? "Memproses foto…"}
        </p>
      ) : (
        <p className="text-xs text-[var(--ink-faint)]">
          Ambil berkali-kali, lalu unggah. Foto 1:1 diperkecil agar HP tidak
          berat. Maks. {MAX_PHOTOS} foto — unggah per 5 foto.
        </p>
      )}

      {error ? (
        <p className="text-sm text-[var(--rose-ink)]">{error}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-lg border border-[var(--line-soft)] bg-[#fffcf7]"
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
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
                onClick={() => removeOne(item.id)}
              >
                Hapus
              </button>
              <p className="truncate px-1 py-0.5 text-[10px] text-[var(--ink-faint)]">
                {formatFileSize(item.file.size)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-sm font-medium text-[var(--ink)]">
        {items.length} foto siap diunggah
      </p>
    </div>
  );
}
