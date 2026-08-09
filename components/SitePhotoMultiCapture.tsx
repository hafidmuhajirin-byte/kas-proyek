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
  const [error, setError] = useState<string | null>(null);
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
    const room = MAX_PHOTOS - itemsRef.current.length;
    if (room <= 0) {
      setError(`Maksimal ${MAX_PHOTOS} foto sekaligus.`);
      return;
    }

    const picked = Array.from(list).slice(0, room);
    setBusy(true);
    try {
      const next: QueuedSitePhoto[] = [];
      for (const raw of picked) {
        if (!raw.type.startsWith("image/") && raw.type !== "") {
          continue;
        }
        try {
          const file = await compressImageFileSquare(raw, {
            maxEdge: 1200,
            maxBytes: 400 * 1024,
            stamp: {
              at: new Date(),
              latitude:
                latNum != null && Number.isFinite(latNum) ? latNum : null,
              longitude:
                lngNum != null && Number.isFinite(lngNum) ? lngNum : null,
            },
          });
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            previewUrl: URL.createObjectURL(file),
          });
        } catch {
          // skip file yang gagal
        }
      }
      if (next.length === 0) {
        setError("Tidak ada foto yang bisa ditambahkan.");
        return;
      }
      onChange([...itemsRef.current, ...next]);
      if (list.length > room) {
        setError(`Hanya ${room} foto lagi yang ditambahkan (batas ${MAX_PHOTOS}).`);
      }
    } finally {
      setBusy(false);
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
          Memproses foto 1:1…
        </p>
      ) : (
        <p className="text-xs text-[var(--ink-faint)]">
          Ambil berkali-kali dulu, lalu unggah sekaligus. Foto 1:1, stempel
          waktu{latNum != null && lngNum != null ? " + GPS" : ""} di foto.
          Maks. {MAX_PHOTOS} foto.
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
