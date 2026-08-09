"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  isMandor,
  isOwner,
  requireProjectAccess,
  requireSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

const MAX_PHOTOS = 20;

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

/**
 * Upload satu atau banyak foto lokasi proyek (Mandor) — disimpan di VPS.
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
  const photos = collectPhotoFiles(formData);

  if (!projectId || !dateRaw) {
    return { error: "Proyek dan tanggal wajib diisi." };
  }
  if (photos.length === 0) {
    return { error: "Tambahkan minimal satu foto sebelum mengunggah." };
  }
  if (photos.length > MAX_PHOTOS) {
    return { error: `Maksimal ${MAX_PHOTOS} foto sekaligus.` };
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

  try {
    for (const file of photos) {
      const photoUrl = await saveSitePhoto(file);
      await prisma.projectSitePhoto.create({
        data: {
          projectId,
          createdById: user.id,
          takenAt,
          caption,
          photoUrl,
          latitude,
          longitude,
        },
      });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal unggah foto." };
  }

  revalidatePath("/mandor");
  revalidatePath("/mandor/lokasi");
  revalidatePath("/foto-proyek");
  revalidatePath(`/projects/${projectId}`);
  redirect(
    `/mandor/lokasi?projectId=${projectId}&ok=1&n=${photos.length}`,
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
