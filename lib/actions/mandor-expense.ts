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
import { prisma } from "@/lib/prisma";
import { parseRupiahInput } from "@/lib/money";
import {
  getPencairanOptionsForProject,
  parsePencairanKey,
} from "@/lib/mandor-pencairan";
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

/** Upload pengeluaran Mandor — wajib bukti + acuan pencairan; tidak menyentuh kas besar. */
export async function createMandorExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  if (!isMandor(user)) {
    return { error: "Hanya Mandor yang dapat mengunggah bukti belanja di sini." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));
  const pencairanRaw = String(formData.get("pencairanKey") ?? "");

  if (!projectId || !description || !dateRaw || amount <= 0) {
    return { error: "Proyek, tanggal, nominal, dan keterangan wajib diisi." };
  }

  const pencairan = parsePencairanKey(pencairanRaw);
  if (!pencairan) {
    return { error: "Pilih pencairan / termin yang menjadi acuan bukti." };
  }

  await requireProjectAccess(user, projectId);

  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) return { error: "Tanggal tidak valid." };

  const options = await getPencairanOptionsForProject(projectId);
  const selected = options.find(
    (o) => o.kind === pencairan.kind && o.id === pencairan.id,
  );
  if (!selected) {
    return { error: "Pencairan tidak valid untuk proyek ini." };
  }
  if (amount > selected.remaining) {
    return {
      error: `Nominal melebihi sisa pencairan (${selected.remaining.toLocaleString("id-ID")}).`,
    };
  }

  let proofUrl: string | null = null;
  try {
    proofUrl = await saveProof(formData.get("proof") as File | null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal unggah bukti." };
  }
  if (!proofUrl) {
    return { error: "Bukti foto/nota wajib diunggah." };
  }

  const category = await prisma.category.findFirst({
    where: { name: "Belanja Mandor", type: "EXPENSE" },
  });
  const fallback = await prisma.category.findFirst({
    where: { name: "Lainnya", type: "EXPENSE" },
  });
  const categoryId = category?.id ?? fallback?.id;
  if (!categoryId) return { error: "Kategori belanja belum tersedia." };

  const cashSource =
    (await prisma.cashSource.findFirst({ where: { type: "CASH" } })) ??
    (await prisma.cashSource.findFirst());
  if (!cashSource) return { error: "Sumber kas belum ada." };

  await prisma.transaction.create({
    data: {
      date,
      type: "EXPENSE",
      amount,
      description,
      proofUrl,
      projectId,
      cashSourceId: cashSource.id,
      categoryId,
      createdById: user.id,
      isMandorExpense: true,
      isFromGlobalCash: false,
      linkedMandorDisbursementId:
        pencairan.kind === "disbursement" ? pencairan.id : null,
      linkedContractorAdvanceId:
        pencairan.kind === "advance" ? pencairan.id : null,
    },
  });

  revalidatePath("/mandor");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/transactions");
  revalidatePath("/transactions/project");
  redirect("/mandor");
}
