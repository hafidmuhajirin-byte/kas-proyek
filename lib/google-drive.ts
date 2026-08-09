import { Readable } from "stream";
import { google, type drive_v3 } from "googleapis";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveUploadResult = {
  fileId: string;
  webViewLink: string | null;
  projectFolderId: string;
};

function parseServiceAccountJson(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON belum dikonfigurasi.");
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  }
}

function getRootFolderId(): string {
  const id =
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() ||
    "1j2jja0Xs4AaRYLFKJ1Pz99wfz0ncDdTu";
  if (!id) {
    throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID belum dikonfigurasi.");
  }
  return id;
}

function getDrive(): drive_v3.Drive {
  const credentials = parseServiceAccountJson();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Tanggal folder di zona WIB (YYYY-MM-DD). */
export function dateFolderWib(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Cari folder by exact name di parent; buat hanya jika belum ada (idempotent).
 */
export async function ensureFolder(
  parentId: string,
  name: string,
  drive = getDrive(),
): Promise<string> {
  const safeName = name.trim() || "Tanpa Nama";
  const q = [
    `'${parentId}' in parents`,
    `name = '${escapeDriveQueryValue(safeName)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
  ].join(" and ");

  const listed = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existing = listed.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const id = created.data.id;
  if (!id) throw new Error(`Gagal membuat folder Drive: ${safeName}`);
  return id;
}

/**
 * Upload foto ke: root → {projectName} → {YYYY-MM-DD} → file.
 * Folder proyek di-reuse lewat `existingProjectFolderId` bila ada.
 */
export async function uploadSitePhotoToDrive(opts: {
  projectName: string;
  takenAt: Date;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  existingProjectFolderId?: string | null;
}): Promise<DriveUploadResult> {
  const drive = getDrive();
  const rootId = getRootFolderId();

  const projectFolderId =
    opts.existingProjectFolderId?.trim() ||
    (await ensureFolder(rootId, opts.projectName.trim() || "Tanpa Nama", drive));

  const dayFolderId = await ensureFolder(
    projectFolderId,
    dateFolderWib(opts.takenAt),
    drive,
  );

  const uploaded = await drive.files.create({
    requestBody: {
      name: opts.filename,
      parents: [dayFolderId],
    },
    media: {
      mimeType: opts.mimeType,
      body: Readable.from(opts.buffer),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const fileId = uploaded.data.id;
  if (!fileId) throw new Error("Gagal mengunggah file ke Google Drive.");

  let webViewLink = uploaded.data.webViewLink ?? null;
  if (!webViewLink) {
    webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
  }

  return { fileId, webViewLink, projectFolderId };
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim());
}
