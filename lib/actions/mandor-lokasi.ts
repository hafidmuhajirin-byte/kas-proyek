"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  isMandor,
  requireProjectAccess,
  requireSession,
} from "@/lib/auth";
import {
  isGoogleDriveConfigured,
  uploadSitePhotoToDrive,
} from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

async function saveSitePhoto(file: File | null): Promise<{
  photoUrl: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
}> {
  if (!file || file.size === 0) {
    throw new Error("Foto proyek wajib diunggah.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran foto maksimal 5 MB.");
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error("Foto harus berupa JPG, PNG, atau WEBP.");
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "lokasi");
  await mkdir(uploadsDir, { recursive: true });
  const ext =
    file.type === "image/png"
      ? ".png"
      : file.type === "image/webp"
        ? ".webp"
        : ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);
  return {
    photoUrl: `/uploads/lokasi/${filename}`,
    buffer,
    mimeType: file.type,
    filename,
  };
}

function parseOptionalFloat(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw));
  if (!Number.isFinite(n)) return null;
  if (n < -90 || n > 90) {
    // latitude check first; longitude validated separately by caller range
  }
  return n;
}

/**
 * Upload foto lokasi proyek (Mandor) — VPS + sync Google Drive.
 */
export async function createSitePhotoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  if (!isMandor(user)) {
    return { error: "Hanya Mandor yang dapat mengunggah foto lokasi." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const dateRaw = String(formData.get("date") ?? "");
  const latRaw = formData.get("latitude");
  const lngRaw = formData.get("longitude");

  if (!projectId || !dateRaw) {
    return { error: "Proyek dan tanggal wajib diisi." };
  }

  await requireProjectAccess(user, projectId);

  const takenAt = new Date(dateRaw);
  if (Number.isNaN(takenAt.getTime())) {
    return { error: "Tanggal tidak valid." };
  }

  let latitude = parseOptionalFloat(latRaw);
  let longitude = parseOptionalFloat(lngRaw);
  if (latitude != null && (latitude < -90 || latitude > 90)) latitude = null;
  if (longitude != null && (longitude < -180 || longitude > 180)) {
    longitude = null;
  }
  if (latitude == null || longitude == null) {
    latitude = null;
    longitude = null;
  }

  let saved: Awaited<ReturnType<typeof saveSitePhoto>>;
  try {
    saved = await saveSitePhoto(formData.get("proof") as File | null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal unggah foto." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, driveProjectFolderId: true },
  });
  if (!project) return { error: "Proyek tidak ditemukan." };

  let driveFileId: string | null = null;
  let driveWebViewLink: string | null = null;
  let driveSyncError: string | null = null;

  if (isGoogleDriveConfigured()) {
    try {
      const driveResult = await uploadSitePhotoToDrive({
        projectName: project.name,
        takenAt,
        filename: saved.filename,
        buffer: saved.buffer,
        mimeType: saved.mimeType,
        existingProjectFolderId: project.driveProjectFolderId,
      });
      driveFileId = driveResult.fileId;
      driveWebViewLink = driveResult.webViewLink;
      if (
        !project.driveProjectFolderId ||
        project.driveProjectFolderId !== driveResult.projectFolderId
      ) {
        await prisma.project.update({
          where: { id: project.id },
          data: { driveProjectFolderId: driveResult.projectFolderId },
        });
      }
    } catch (e) {
      driveSyncError =
        e instanceof Error ? e.message.slice(0, 500) : "Gagal sync Google Drive.";
    }
  } else {
    driveSyncError = "Google Drive belum dikonfigurasi di server.";
  }

  await prisma.projectSitePhoto.create({
    data: {
      projectId,
      createdById: user.id,
      takenAt,
      caption,
      photoUrl: saved.photoUrl,
      driveFileId,
      driveWebViewLink,
      driveSyncError,
      latitude,
      longitude,
    },
  });

  revalidatePath("/mandor");
  revalidatePath("/mandor/lokasi");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/mandor/lokasi?projectId=${projectId}&ok=1`);
}
