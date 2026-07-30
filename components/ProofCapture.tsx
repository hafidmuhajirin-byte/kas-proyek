"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
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
};

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const ALL_ACCEPT = `${IMAGE_ACCEPT},application/pdf`;

export function ProofCapture({
  existingProofUrl,
  onApplySuggestion,
}: ProofCaptureProps) {
  const cameraId = useId();
  const galleryId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const hiddenFileRef = useRef<HTMLInputElement>(null);

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

  function syncHiddenInput(next: File | null) {
    const input = hiddenFileRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    if (next) dt.items.add(next);
    input.files = dt.files;
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

    if (!next) {
      setFile(null);
      setPreviewUrl(null);
      setIsPdf(false);
      setOriginalSize(null);
      syncHiddenInput(null);
      return;
    }

    const pdf = next.type === "application/pdf";
    setFile(next);
    setIsPdf(pdf);
    setOriginalSize(meta?.originalSize ?? null);
    setPreviewUrl(pdf ? null : URL.createObjectURL(next));
    syncHiddenInput(next);
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = "";

    if (!picked) {
      assignFile(null);
      return;
    }

    if (picked.type === "application/pdf") {
      assignFile(picked);
      return;
    }

    if (!picked.type.startsWith("image/")) {
      assignFile(picked);
      return;
    }

    setCompressing(true);
    setOcrError(null);
    try {
      const compressed = await compressImageFile(picked);
      assignFile(compressed, { originalSize: picked.size });
    } catch {
      // Fallback: tetap pakai file asli jika kompresi gagal
      assignFile(picked, { originalSize: picked.size });
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
      <input
        ref={hiddenFileRef}
        id="proof"
        name="proof"
        type="file"
        accept={ALL_ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />

      <input
        ref={cameraRef}
        id={cameraId}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => void onPick(e)}
      />
      <input
        ref={galleryRef}
        id={galleryId}
        type="file"
        accept={ALL_ACCEPT}
        className="hidden"
        onChange={(e) => void onPick(e)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={compressing}
          onClick={() => cameraRef.current?.click()}
        >
          Ambil foto
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={compressing}
          onClick={() => galleryRef.current?.click()}
        >
          Dari galeri
        </button>
        {file ? (
          <button
            type="button"
            className={`${btnSecondaryClass} text-[var(--rose-ink)]`}
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

      {file && !isPdf ? (
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
          Ambil foto dari kamera HP atau pilih dari galeri / PDF. Foto
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
