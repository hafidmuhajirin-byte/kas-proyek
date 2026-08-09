"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireRoleAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRupiahInput } from "@/lib/money";
import type { FormState } from "@/lib/actions/projects";

async function saveProof(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran bukti maksimal 5 MB.");
  }
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) {
    throw new Error("Bukti harus berupa JPG, PNG, WEBP, atau PDF.");
  }
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const ext =
    file.type === "application/pdf"
      ? ".pdf"
      : file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
          ? ".webp"
          : ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  await writeFile(
    path.join(uploadsDir, filename),
    Buffer.from(await file.arrayBuffer()),
  );
  return `/uploads/${filename}`;
}

const ADMIN_LPJ_PREFIX = "[Admin LPJ]";

/**
 * Admin menambahkan nota khusus LPJ (nilai penuh di BKU/BKT/pajak).
 * Di Owner tampil sebagai bukti tambahan Rp 0 — tidak menambah totalBukti / kas.
 * Tidak wajib tautan pencairan Mandor.
 */
export async function createAdminLpjNotaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRoleAdmin();

  const projectId = String(formData.get("projectId") ?? "");
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const isMaterialAlam = formData.get("isMaterialAlam") === "on";
  const proofUrlField = String(formData.get("proofUrl") ?? "").trim();

  if (!projectId || !descriptionRaw || !dateRaw || amount <= 0) {
    return { error: "Proyek, tanggal, nominal, dan uraian wajib diisi." };
  }
  if (!categoryId) {
    return { error: "Kategori belanja wajib dipilih." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true },
  });
  if (!project || project.status !== "ACTIVE") {
    return { error: "Proyek tidak ditemukan atau tidak aktif." };
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, type: "EXPENSE" },
    select: { id: true },
  });
  if (!category) {
    return { error: "Kategori belanja tidak valid." };
  }

  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) return { error: "Tanggal tidak valid." };

  let proofUrl: string | null = null;
  try {
    proofUrl = await saveProof(formData.get("proof") as File | null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal unggah bukti." };
  }
  if (!proofUrl && proofUrlField) {
    if (!/^https?:\/\//i.test(proofUrlField) && !proofUrlField.startsWith("/")) {
      return { error: "URL bukti tidak valid." };
    }
    proofUrl = proofUrlField;
  }
  if (!proofUrl) {
    return { error: "Bukti foto/nota wajib diunggah atau diisi URL." };
  }

  const cashSource =
    (await prisma.cashSource.findFirst({ where: { type: "CASH" } })) ??
    (await prisma.cashSource.findFirst());
  if (!cashSource) return { error: "Sumber kas belum ada." };

  const description = descriptionRaw.startsWith(ADMIN_LPJ_PREFIX)
    ? descriptionRaw
    : `${ADMIN_LPJ_PREFIX} ${descriptionRaw}`;

  await prisma.transaction.create({
    data: {
      date,
      type: "EXPENSE",
      amount,
      description,
      proofUrl,
      projectId,
      cashSourceId: cashSource.id,
      categoryId: category.id,
      createdById: user.id,
      isMandorExpense: true,
      isAdminLpjNota: true,
      isMaterialAlam,
      isFromGlobalCash: false,
      linkedMandorDisbursementId: null,
      linkedContractorAdvanceId: null,
    },
  });

  revalidatePath(`/admin/lpj/${projectId}/nota`);
  revalidatePath(`/admin/lpj/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/transactions/project");

  return { success: "Nota Admin LPJ berhasil ditambahkan." };
}
