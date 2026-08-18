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
  parseReceiptText,
  type ReceiptOcrSuggestion,
} from "@/lib/receipt-ocr";
import {
  compressImageFile,
  formatFileSize,
} from "@/lib/compress-image";
import { formatRupiah } from "@/lib/money";
import { btnSecondaryClass, inputClass } from "@/components/ui";

type ProofCaptureProps = {
  existingProofUrl?: string | null;
  onApplySuggestion?: (suggestion: ReceiptOcrSuggestion) => void;
  /** Dipanggil tiap file bukti siap (atau null saat dihapus) — untuk inject ke FormData di iOS. */
  onFileChange?: (file: File | null) => void;
  /** Hanya gambar (tanpa PDF / OCR) — untuk foto lokasi proyek. */
  imagesOnly?: boolean;
};

/** Galeri: longgar agar iPhone HEIC/galeri tidak terfilter. */
const GALLERY_ACCEPT = "image/*,image/heic,image/heif,.heic,.heif,application/pdf";
const GALLERY_IMAGES_ONLY = "image/*,image/heic,image/heif,.heic,.heif";

/** Input file menempel di atas tombol — lebih andal di Android daripada input.hidden + click(). */
function FilePickButton({
  label,
  disabled,
  accept,
  capture,
  inputRef,
  onChange,
}: {
  label: ReactNode;
  disabled?: boolean;
  accept: string;
  capture?: boolean | "user" | "environment";
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const autoId = useId().replace(/:/g, "");
  const id = `proof-pick-${autoId}`;

  return (
    <label
      htmlFor={id}
      className={`${btnSecondaryClass} relative min-h-12 flex-1 cursor-pointer overflow-hidden sm:flex-none ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <span className="pointer-events-none">{label}</span>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        {...(capture ? { capture } : {})}
        disabled={disabled}
        onChange={onChange}
        // Jangan display:none — beberapa HP mengabaikan klik ke input tersembunyi.
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        style={{ fontSize: "16px" }}
      />
    </label>
  );
}

export function ProofCapture({
  existingProofUrl,
  onApplySuggestion,
  onFileChange,
  imagesOnly = false,
}: ProofCaptureProps) {
  const acceptGallery = imagesOnly ? GALLERY_IMAGES_ONLY : GALLERY_ACCEPT;
  const enableOcr = Boolean(onApplySuggestion) && !imagesOnly;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const hiddenFileRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ReceiptOcrSuggestion | null>(
    null,
  );
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /** Fallback non-iOS: isi input name=proof. iOS Safari sering gagal — pakai onFileChange. */
  function syncHiddenInput(next: File | null) {
    const input = hiddenFileRef.current;
    if (!input) return;
    try {
      const dt = new DataTransfer();
      if (next) dt.items.add(next);
      input.files = dt.files;
    } catch {
      // iOS / browser ketat: biarkan onFileChange yang mengirim file
    }
  }

  function assignFile(
    next: File | null,
    meta?: { originalSize?: number | null },
  ) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSuggestion(null);
    setApplied(false);
    setOcrError(null);
    setOcrProgress(0);

    fileRef.current = next;
    onFileChange?.(next);
    syncHiddenInput(next);

    if (!next) {
      setFile(null);
      setPreviewUrl(null);
      setIsPdf(false);
      setOriginalSize(null);
      return;
    }

    const pdf = next.type === "application/pdf";
    setFile(next);
    setIsPdf(pdf);
    setOriginalSize(meta?.originalSize ?? null);
    setPreviewUrl(pdf ? null : URL.createObjectURL(next));
  }

  function looksLikeImage(file: File) {
    const t = (file.type || "").toLowerCase();
    if (t.startsWith("image/")) return true;
    // Beberapa kamera HP mengirim MIME kosong — cek ekstensi
    if (t === "" || t === "application/octet-stream") {
      return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name);
    }
    return false;
  }

  function isHeicLike(file: File) {
    const t = (file.type || "").toLowerCase();
    return (
      t === "image/heic" ||
      t === "image/heif" ||
      /\.heic$/i.test(file.name) ||
      /\.heif$/i.test(file.name)
    );
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    // Reset value agar foto yang sama bisa dipilih lagi
    e.target.value = "";

    if (!picked) {
      return;
    }

    if (picked.type === "application/pdf") {
      if (imagesOnly) {
        setOcrError("Hanya foto (JPG/PNG/WEBP) yang diterima.");
        return;
      }
      assignFile(picked);
      return;
    }

    if (!looksLikeImage(picked)) {
      setOcrError("File bukan gambar/PDF yang didukung.");
      return;
    }

    setCompressing(true);
    setOcrError(null);
    try {
      const compressed = await compressImageFile(picked);
      // Pastikan hasil JPEG (server menolak HEIC mentah)
      if (isHeicLike(compressed)) {
        throw new Error("HEIC");
      }
      assignFile(compressed, { originalSize: picked.size });
    } catch {
      setOcrError(
        isHeicLike(picked)
          ? "Foto HEIC iPhone gagal diproses. Coba Ambil foto lagi, atau di Kamera iPhone: Settings → Camera → Formats → Most Compatible."
          : "Gagal memproses foto. Coba Ambil foto ulang atau pilih Dari galeri.",
      );
      assignFile(null);
    } finally {
      setCompressing(false);
    }
  }

  async function runOcr() {
    if (!file || isPdf) return;
    setOcrBusy(true);
    setOcrError(null);
    setOcrProgress(0);
    setSuggestion(null);
    setApplied(false);

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["ind", "eng"], 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      try {
        const { data } = await worker.recognize(file);
        const parsed = parseReceiptText(data.text ?? "");
        if (!parsed.rawText && parsed.amount == null) {
          setOcrError(
            "Tidak ada teks terbaca. Coba foto lebih terang dan nota rata.",
          );
        } else {
          setSuggestion(parsed);
        }
      } finally {
        await worker.terminate();
      }
    } catch {
      setOcrError(
        "Gagal membaca nota. Pastikan koneksi ada (unduh model OCR) lalu coba lagi.",
      );
    } finally {
      setOcrBusy(false);
    }
  }

  function applySuggestion() {
    if (!suggestion || !onApplySuggestion) return;
    onApplySuggestion(suggestion);
    setApplied(true);
  }

  const sizeHint =
    file && !isPdf
      ? originalSize != null && originalSize > file.size
        ? `Dikompres otomatis: ${formatFileSize(originalSize)} → ${formatFileSize(file.size)}`
        : `Ukuran bukti: ${formatFileSize(file.size)}`
      : null;

  return (
    <div className="space-y-3">
      {/* Fallback submit (Chrome/Android). iOS: MandorUploadForm inject via onFileChange. */}
      <input
        ref={hiddenFileRef}
        id="proof"
        name="proof"
        type="file"
        accept={acceptGallery}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={() => {
          /* diisi lewat DataTransfer dari assignFile */
        }}
      />

      <div className="flex flex-wrap gap-2">
        {/* capture=environment → kamera belakang; input menempel di tombol */}
        <FilePickButton
          label="Ambil foto"
          disabled={compressing}
          accept="image/*"
          capture="environment"
          inputRef={cameraRef}
          onChange={(e) => void onPick(e)}
        />
        {/* Tanpa capture → galeri / file picker */}
        <FilePickButton
          label="Dari galeri"
          disabled={compressing}
          accept={acceptGallery}
          inputRef={galleryRef}
          onChange={(e) => void onPick(e)}
        />
        {file ? (
          <button
            type="button"
            className={`${btnSecondaryClass} flex-1 text-[var(--rose-ink)] sm:flex-none`}
            disabled={compressing}
            onClick={() => assignFile(null)}
          >
            Hapus
          </button>
        ) : null}
      </div>

      {compressing ? (
        <p className="text-sm text-[var(--ink-faint)]">
          Mengompres foto agar lebih ringan…
        </p>
      ) : null}

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Pratinjau bukti"
          className="max-h-56 w-full rounded-lg border border-[var(--line)] object-contain bg-[#fffcf7]"
        />
      ) : isPdf && file ? (
        <p className={`${inputClass} py-2 text-sm`}>
          PDF dipilih: <span className="font-medium">{file.name}</span>
        </p>
      ) : null}

      {sizeHint ? (
        <p className="text-xs text-[var(--ink-faint)]">{sizeHint}</p>
      ) : null}

      {file && !isPdf && enableOcr ? (
        <div className="space-y-2">
          <button
            type="button"
            className={btnSecondaryClass}
            disabled={ocrBusy || compressing}
            onClick={() => void runOcr()}
          >
            {ocrBusy
              ? `Membaca nota… ${ocrProgress}%`
              : "Baca teks nota (OCR)"}
          </button>
          <p className="text-xs text-[var(--ink-faint)]">
            OCR membantu mengisi usulan. Cek nominal sebelum simpan. Hasil
            jelek jika foto gelap/miring — foto terang, nota rata.
          </p>
        </div>
      ) : file && isPdf ? (
        <p className="text-xs text-[var(--ink-faint)]">
          PDF bisa diunggah sebagai bukti. OCR fase 1 hanya untuk gambar.
        </p>
      ) : !compressing ? (
        <p className="text-xs text-[var(--ink-faint)]">
          Ketuk <strong>Ambil foto</strong> untuk kamera HP, atau{" "}
          <strong>Dari galeri</strong> jika kamera tidak terbuka. Foto
          dikompres otomatis sebelum disimpan.
        </p>
      ) : null}

      {ocrError ? (
        <p className="text-sm text-[var(--rose-ink)]">{ocrError}</p>
      ) : null}

      {suggestion ? (
        <div className="space-y-2 rounded-lg border border-[var(--line)] bg-[#fffcf7] p-3 text-sm">
          <p className="font-medium text-[var(--ink)]">Usulan dari OCR</p>
          <ul className="space-y-1 text-[var(--ink)]/85">
            <li>
              Nominal:{" "}
              {suggestion.amount != null
                ? formatRupiah(suggestion.amount)
                : "— (tidak terdeteksi)"}
            </li>
            <li>
              Keterangan: {suggestion.descriptionHint ?? "—"}
            </li>
          </ul>
          {onApplySuggestion ? (
            <button
              type="button"
              className={btnSecondaryClass}
              onClick={applySuggestion}
              disabled={applied}
            >
              {applied ? "Sudah diterapkan ke form" : "Terapkan ke form"}
            </button>
          ) : null}
          {suggestion.rawText ? (
            <details className="text-xs text-[var(--ink-faint)]">
              <summary className="cursor-pointer">Teks mentah OCR</summary>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">
                {suggestion.rawText}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {existingProofUrl ? (
        <p className="text-xs text-teal-900/55">
          Bukti saat ini:{" "}
          <a
            href={existingProofUrl}
            target="_blank"
            rel="noreferrer"
            className="text-teal-700 underline"
          >
            lihat
          </a>
          {file ? " — diganti jika Anda menyimpan file baru" : null}
        </p>
      ) : null}
    </div>
  );
}
