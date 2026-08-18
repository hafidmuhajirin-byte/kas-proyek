export const SITE_VIDEO_MAX_DURATION_SEC = 60;
export const SITE_VIDEO_MAX_TOTAL_SEC = 300;
export const SITE_VIDEO_MAX_SOURCE_BYTES = 40 * 1024 * 1024;
export const SITE_VIDEO_MAX_OUTPUT_BYTES = 3 * 1024 * 1024;
export const SITE_VIDEO_ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
];

const GENERIC_CAMERA_VIDEO_NAMES = new Set([
  "video.mp4",
  "video.mov",
  "video.webm",
  "capture.mp4",
  "capture.mov",
  "movie.mp4",
  "trim.mp4",
]);

export function looksLikeVideo(file: { type?: string; name?: string }): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("video/")) return true;
  if (t === "" || t === "application/octet-stream") {
    return /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name || "");
  }
  return SITE_VIDEO_ALLOWED_TYPES.includes(t);
}

export function isAllowedVideoType(file: { type?: string; name?: string }): boolean {
  const t = (file.type || "").toLowerCase();
  if (SITE_VIDEO_ALLOWED_TYPES.includes(t)) return true;
  return /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name || "");
}

export function isGenericCameraVideoName(name: string): boolean {
  const n = name.trim().split(/[/\\]/).pop()?.toLowerCase() ?? "";
  return !n || GENERIC_CAMERA_VIDEO_NAMES.has(n) || n === "blob";
}
