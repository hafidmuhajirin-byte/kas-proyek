/** Kompresi gambar di browser (canvas) — tanpa dependency ekstra. */

export type CompressImageOptions = {
  /** Sisi terpanjang maksimal (px). Default 1600 — cukup untuk nota. */
  maxEdge?: number;
  /** Kualitas JPEG 0–1. Default 0.7. */
  quality?: number;
  /** Target ukuran maksimal (bytes). Akan turunkan quality jika perlu. Default 400 KB. */
  maxBytes?: number;
  /** Paksa encode ulang (jangan kembalikan file asli). */
  forceEncoded?: boolean;
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

/**
 * Decode gambar ke canvas. Utamakan createImageBitmap (Safari iOS bisa HEIC),
 * lalu fallback ke <img> + object URL.
 */
async function drawFileToCanvas(
  file: File,
  maxEdge: number,
): Promise<HTMLCanvasElement> {
  let width = 0;
  let height = 0;
  let draw: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null =
    null;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      draw = (ctx, w, h) => {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close?.();
      };
    } catch {
      // lanjut ke Image()
    }
  }

  if (!draw || !width || !height) {
    const img = await loadImage(file);
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
    draw = (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h);
  }

  if (!draw || !width || !height) {
    throw new Error("Gagal membaca ukuran gambar.");
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  draw(ctx, outW, outH);
  return canvas;
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
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  if (t === "" || t === "application/octet-stream") {
    return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name);
  }
  return false;
}

async function encodeJpegCanvas(
  canvas: HTMLCanvasElement,
  file: File,
  options: CompressImageOptions,
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
  const canvas = await drawFileToCanvas(file, maxEdge);
  const t = (file.type || "").toLowerCase();
  const heicLike =
    t === "image/heic" ||
    t === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);
  // HEIC harus selalu di-encode ulang ke JPEG (server menolak HEIC mentah)
  return encodeJpegCanvas(
    canvas,
    file,
    { ...options, forceEncoded: heicLike || options.forceEncoded },
    "bukti",
  );
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

  // Decode penuh dulu (createImageBitmap / Image), lalu crop 1:1
  let srcW = 0;
  let srcH = 0;
  let bitmap: ImageBitmap | null = null;
  let img: HTMLImageElement | null = null;

  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(file);
      srcW = bitmap.width;
      srcH = bitmap.height;
    } catch {
      bitmap = null;
    }
  }
  if (!bitmap) {
    img = await loadImage(file);
    srcW = img.naturalWidth || img.width;
    srcH = img.naturalHeight || img.height;
  }

  const side = Math.min(srcW, srcH);
  const sx = Math.max(0, Math.floor((srcW - side) / 2));
  const sy = Math.max(0, Math.floor((srcH - side) / 2));
  const out = Math.min(side, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap?.close?.();
    return file;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out, out);
  if (bitmap) {
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
    bitmap.close?.();
  } else if (img) {
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
  }

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
