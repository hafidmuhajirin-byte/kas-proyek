"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  isMandorLike,
  isOwner,
  requireProjectAccess,
  requireSession,
} from "@/lib/auth";
import { normalizeSourceName } from "@/lib/site-photo-name";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

/** Maks per request batch (client mengirim bertahap). */
const MAX_PHOTOS_PER_BATCH = 5;

async function saveSitePhoto(file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error("Ada foto kosong.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran tiap foto maksimal 5 MB.");
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
  await writeFile(
    path.join(uploadsDir, filename),
    Buffer.from(await file.arrayBuffer()),
  );
  return `/uploads/lokasi/${filename}`;
}

function parseOptionalFloat(raw: FormDataEntryValue | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw));
  if (!Number.isFinite(n)) return null;
  return n;
}

function collectPhotoFiles(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

function collectSourceNames(formData: FormData, count: number): string[] {
  const named = formData
    .getAll("sourceNames")
    .map((v) => normalizeSourceName(String(v)))
    .filter(Boolean);
  if (named.length === count) return named;
  // Fallback: pakai nama File (galeri)
  return collectPhotoFiles(formData).map((f, i) => {
    const n = normalizeSourceName(f.name);
    return n || `upload-${Date.now()}-${i}.jpg`;
  });
}

type UploadResult = FormState & { count?: number };

async function savePhotosFromForm(
  formData: FormData,
): Promise<UploadResult> {
  const user = await requireSession();
  if (!isMandorLike(user)) {
    return { error: "Hanya Mandor / ADM Foto yang dapat mengunggah foto." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const dateRaw = String(formData.get("date") ?? "");
  const latRaw = formData.get("latitude");
  const lngRaw = formData.get("longitude");
  const photos = collectPhotoFiles(formData);

  if (!projectId || !dateRaw) {
    return { error: "Proyek dan tanggal wajib diisi." };
  }
  if (photos.length === 0) {
    return { error: "Tambahkan minimal satu foto sebelum mengunggah." };
  }
  if (photos.length > MAX_PHOTOS_PER_BATCH) {
    return {
      error: `Maksimal ${MAX_PHOTOS_PER_BATCH} foto per pengiriman. Coba lagi.`,
    };
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { error: "Proyek tidak ditemukan." };

  const sourceNames = collectSourceNames(formData, photos.length);
  if (sourceNames.length !== photos.length) {
    return { error: "Data nama foto tidak lengkap." };
  }

  const uniqueNames = new Set(sourceNames);
  if (uniqueNames.size !== sourceNames.length) {
    return { error: "Ada nama foto yang sama dalam unggahan." };
  }

  const existing = await prisma.projectSitePhoto.findMany({
    where: {
      projectId,
      sourceName: { in: sourceNames },
    },
    select: { sourceName: true },
  });
  if (existing.length > 0) {
    const sample = existing[0]!.sourceName;
    return {
      error:
        existing.length === 1
          ? `Foto "${sample}" sudah pernah diunggah.`
          : `${existing.length} foto sudah pernah diunggah (nama sama).`,
    };
  }

  try {
    const rows: {
      projectId: string;
      createdById: string;
      takenAt: Date;
      caption: string | null;
      photoUrl: string;
      sourceName: string;
      latitude: number | null;
      longitude: number | null;
    }[] = [];

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]!;
      const sourceName = sourceNames[i]!;
      const photoUrl = await saveSitePhoto(file);
      rows.push({
        projectId,
        createdById: user.id,
        takenAt,
        caption,
        photoUrl,
        sourceName,
        latitude,
        longitude,
      });
    }

    await prisma.projectSitePhoto.createMany({ data: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal unggah foto.";
    if (/Unique constraint|sourceName/i.test(msg)) {
      return { error: "Ada foto dengan nama yang sudah dipakai." };
    }
    return { error: msg };
  }

  // Jangan revalidate di tengah batch — refresh halaman memutus unggah berikutnya.
  const skipRevalidate = formData.get("skipRevalidate") === "1";
  if (!skipRevalidate) {
    revalidatePath("/mandor");
    revalidatePath("/mandor/lokasi");
    revalidatePath("/foto-proyek");
    revalidatePath(`/projects/${projectId}`);
  }
  return { success: "ok", count: photos.length };
}

/** Refresh daftar foto setelah semua batch selesai. */
export async function revalidateSitePhotosAction(
  projectId: string,
): Promise<void> {
  const user = await requireSession();
  if (!isMandorLike(user)) return;
  revalidatePath("/mandor");
  revalidatePath("/mandor/lokasi");
  revalidatePath("/foto-proyek");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/**
 * Upload batch foto (tanpa redirect) — dipanggil bertahap dari client.
 */
export async function uploadSitePhotosBatchAction(
  _prev: FormState,
  formData: FormData,
): Promise<UploadResult> {
  return savePhotosFromForm(formData);
}

/**
 * Upload + redirect (kompatibel form tunggal).
 */
export async function createSitePhotoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await savePhotosFromForm(formData);
  if (result.error) return { error: result.error };

  const projectId = String(formData.get("projectId") ?? "");
  redirect(
    `/mandor/lokasi?projectId=${projectId}&ok=1&n=${result.count ?? 1}`,
  );
}

/** Hapus foto lokasi — hanya Owner. */
export async function deleteSitePhotoAction(
  formData: FormData,
): Promise<void> {
  const user = await requireSession();
  if (!isOwner(user)) {
    redirect("/foto-proyek");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/foto-proyek");

  const photo = await prisma.projectSitePhoto.findUnique({
    where: { id },
    select: { id: true, photoUrl: true, projectId: true },
  });
  if (!photo) redirect("/foto-proyek");

  await prisma.projectSitePhoto.delete({ where: { id: photo.id } });

  if (photo.photoUrl.startsWith("/uploads/")) {
    const rel = photo.photoUrl.replace(/^\//, "");
    const abs = path.join(process.cwd(), "public", rel);
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    if (abs.startsWith(uploadsRoot + path.sep)) {
      try {
        await unlink(abs);
      } catch {
        // file mungkin sudah tidak ada
      }
    }
  }

  revalidatePath("/foto-proyek");
  revalidatePath("/mandor/lokasi");
  revalidatePath(`/projects/${photo.projectId}`);

  const back = String(formData.get("returnTo") ?? "/foto-proyek");
  redirect(back.startsWith("/") ? back : "/foto-proyek");
}
