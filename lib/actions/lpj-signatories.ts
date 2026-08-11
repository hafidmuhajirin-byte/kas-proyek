"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLpjEditor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function str(raw: FormDataEntryValue | null) {
  const s = String(raw ?? "").trim();
  return s.length ? s : null;
}

async function saveSignatureAsset(file: File | null, prefix: string) {
  if (!file || file.size === 0) return null;
  if (file.type !== "image/png") {
    throw new Error("File tanda tangan/stempel harus PNG.");
  }
  if (file.size > 3 * 1024 * 1024) {
    throw new Error("Ukuran PNG maksimal 3 MB.");
  }
  const dir = path.join(process.cwd(), "public", "uploads", "lpj-sign");
  await mkdir(dir, { recursive: true });
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/lpj-sign/${filename}`;
}

export async function updateLpjSignatoriesAction(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) redirect("/admin/lpj");
  await requireLpjEditor(projectId);

  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      lpjKepalaTtdUrl: true,
      lpjKetuaTtdUrl: true,
      lpjBendaharaTtdUrl: true,
      lpjStempelUrl: true,
    },
  });
  if (!existing) redirect("/admin/lpj");

  const kepalaTtdUrl =
    (await saveSignatureAsset(
      formData.get("lpjKepalaTtd") as File | null,
      "kepala-ttd",
    )) ?? existing.lpjKepalaTtdUrl;
  const ketuaTtdUrl =
    (await saveSignatureAsset(
      formData.get("lpjKetuaTtd") as File | null,
      "ketua-ttd",
    )) ?? existing.lpjKetuaTtdUrl;
  const bendaharaTtdUrl =
    (await saveSignatureAsset(
      formData.get("lpjBendaharaTtd") as File | null,
      "bendahara-ttd",
    )) ?? existing.lpjBendaharaTtdUrl;
  const stempelUrl =
    (await saveSignatureAsset(
      formData.get("lpjStempel") as File | null,
      "stempel",
    )) ?? existing.lpjStempelUrl;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      lpjKepalaNama: str(formData.get("lpjKepalaNama")),
      lpjKepalaNip: str(formData.get("lpjKepalaNip")),
      lpjKetuaNama: str(formData.get("lpjKetuaNama")),
      lpjKetuaNip: str(formData.get("lpjKetuaNip")),
      lpjBendaharaNama: str(formData.get("lpjBendaharaNama")),
      lpjBendaharaNip: str(formData.get("lpjBendaharaNip")),
      lpjKabKota: str(formData.get("lpjKabKota")),
      lpjProvinsi: str(formData.get("lpjProvinsi")),
      lpjNpwp: str(formData.get("lpjNpwp")),
      lpjKepalaTtdUrl: kepalaTtdUrl,
      lpjKetuaTtdUrl: ketuaTtdUrl,
      lpjBendaharaTtdUrl: bendaharaTtdUrl,
      lpjStempelUrl: stempelUrl,
    },
  });

  revalidatePath(`/admin/lpj/${projectId}`);
  revalidatePath(`/admin/lpj/${projectId}/bank`);
  revalidatePath(`/admin/lpj/${projectId}/export`);
  revalidatePath(`/admin/lpj/${projectId}/spk`);
  revalidatePath(`/admin/lpj/${projectId}/pajak`);
  redirect(`/admin/lpj/${projectId}/bank`);
}
