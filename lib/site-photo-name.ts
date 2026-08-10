/** Normalisasi nama file sumber untuk dedupe (unik per proyek). */
export function normalizeSourceName(raw: string): string {
  const base = raw.trim().split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/\s+/g, " ").slice(0, 240);
  return cleaned.toLowerCase();
}

const GENERIC_CAMERA_NAMES = new Set([
  "image.jpg",
  "image.jpeg",
  "image.png",
  "image.webp",
  "photo.jpg",
  "photo.jpeg",
  "capture.jpg",
  "capture.jpeg",
]);

/** Nama generik dari kamera browser. */
export function isGenericCameraName(name: string): boolean {
  const n = normalizeSourceName(name);
  return !n || GENERIC_CAMERA_NAMES.has(n) || n === "blob" || n === "untitled";
}

async function shortContentHash(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const slice = buf.slice(0, Math.min(buf.byteLength, 65536));
  const digest = await crypto.subtle.digest("SHA-256", slice);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Kunci unik per proyek:
 * - Galeri: nama file asli (normalized)
 * - Kamera / nama generik: hash isi (cegah foto dobel meski nama selalu image.jpg)
 */
export async function sourceNameFromFile(
  file: File,
  fromCamera: boolean,
): Promise<string> {
  const raw = normalizeSourceName(file.name || "");
  if (fromCamera || isGenericCameraName(raw)) {
    const hash = await shortContentHash(file);
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    return `cam-${hash}.${ext}`;
  }
  return raw;
}
