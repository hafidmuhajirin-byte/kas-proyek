/** Kompresi gambar di browser (canvas) — tanpa dependency ekstra. */

export type CompressImageOptions = {
  /** Sisi terpanjang maksimal (px). Default 1600 — cukup untuk nota. */
  maxEdge?: number;
  /** Kualitas JPEG 0–1. Default 0.7. */
  quality?: number;
  /** Target ukuran maksimal (bytes). Akan turunkan quality jika perlu. Default 400 KB. */
  maxBytes?: number;
};

export type SitePhotoStamp = {
  /** Stempel waktu (default: sekarang, zona WIB). */
  at?: Date;
  latitude?: number | null;
  longitude?: number | null;
};

function formatStampWib(date: Date): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}  ${get("hour")}:${get("minute")} WIB`;
}

/** Gambar stempel waktu (+ GPS) di bagian bawah canvas. */
function drawTimestampStamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stamp: SitePhotoStamp,
) {
  const line1 = formatStampWib(stamp.at ?? new Date());
  const hasGps =
    stamp.latitude != null &&
    stamp.longitude != null &&
    Number.isFinite(stamp.latitude) &&
    Number.isFinite(stamp.longitude);
  const line2 = hasGps
    ? `${stamp.latitude!.toFixed(5)}, ${stamp.longitude!.toFixed(5)}`
    : null;

  const pad = Math.max(8, Math.round(width * 0.03));
  const fontSize = Math.max(14, Math.round(width * 0.035));
  const lineH = Math.round(fontSize * 1.25);
  const barH = pad * 2 + lineH * (line2 ? 2 : 1);

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, height - barH, width, barH);

  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 2;

  let y = height - barH + pad;
  ctx.fillText(line1, pad, y, width - pad * 2);
  if (line2) {
    y += lineH;
    ctx.font = `500 ${Math.round(fontSize * 0.92)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(line2, pad, y, width - pad * 2);
  }
  ctx.restore();
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal memuat gambar untuk kompresi."));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Gagal membuat blob gambar."));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

function baseName(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function isProbablyImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "" || file.type === "application/octet-stream") {
    return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name);
  }
  return false;
}

async function encodeJpegCanvas(
  canvas: HTMLCanvasElement,
  file: File,
  options: CompressImageOptions & { forceEncoded?: boolean },
  defaultName: string,
): Promise<File> {
  const maxBytes = options.maxBytes ?? 400 * 1024;
  let quality = options.quality ?? 0.7;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);

  while (blob.size > maxBytes && quality > 0.4) {
    quality = Math.round((quality - 0.08) * 100) / 100;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  if (
    !options.forceEncoded &&
    blob.size >= file.size &&
    (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) &&
    file.size <= maxBytes
  ) {
    return file;
  }

  return new File([blob], `${baseName(file.name) || defaultName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Resize + JPEG compress. PDF / non-image dikembalikan apa adanya.
 * Hasil selalu `image/jpeg` agar ringan dan konsisten.
 * Dipakai untuk Ambil foto (kamera) dan Dari galeri.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!isProbablyImage(file)) return file;

  const maxEdge = options.maxEdge ?? 1600;
  const img = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return encodeJpegCanvas(canvas, file, options, "bukti");
}

/**
 * Crop tengah 1:1, stempel waktu/GPS, lalu kompres JPEG (foto lokasi proyek).
 */
export async function compressImageFileSquare(
  file: File,
  options: CompressImageOptions & { stamp?: SitePhotoStamp | false } = {},
): Promise<File> {
  if (!isProbablyImage(file)) return file;

  const maxEdge = options.maxEdge ?? 1200;
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  const sx = Math.max(0, Math.floor((img.width - side) / 2));
  const sy = Math.max(0, Math.floor((img.height - side) / 2));
  const out = Math.min(side, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);

  if (options.stamp !== false) {
    drawTimestampStamp(ctx, out, out, options.stamp ?? {});
  }

  return encodeJpegCanvas(
    canvas,
    file,
    { ...options, forceEncoded: true },
    "lokasi",
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
