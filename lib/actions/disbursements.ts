"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRupiahInput, formatRupiah } from "@/lib/money";
import {
  getChannelCashBalance,
  getGlobalCashBalance,
} from "@/lib/balance";
import type { FormState } from "@/lib/actions/projects";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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

export async function createMandorDisbursementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();

  const projectId = String(formData.get("projectId") ?? "");
  const mandorId = String(formData.get("mandorId") ?? "");
  const cashSourceId = String(formData.get("cashSourceId") ?? "");
  const label = String(formData.get("label") ?? "").trim() || "Termin";
  const description = String(formData.get("description") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));
  const fromGlobal = formData.get("isFromGlobalCash") === "on";

  if (!projectId || !mandorId || !cashSourceId || !dateRaw || amount <= 0) {
    return { error: "Proyek, mandor, sumber kas, tanggal, dan nominal wajib." };
  }

  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) return { error: "Tanggal tidak valid." };

  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: { userId: mandorId, projectId },
    },
  });
  if (!assignment) {
    return { error: "Mandor belum ditugaskan ke proyek ini." };
  }

  const mandor = await prisma.user.findFirst({
    where: { id: mandorId, role: "MANDOR" },
  });
  if (!mandor) return { error: "User bukan Mandor." };

  const source = await prisma.cashSource.findUnique({
    where: { id: cashSourceId },
  });
  if (!source) return { error: "Sumber kas tidak ditemukan." };

  const category = await prisma.category.findFirst({
    where: { name: "Pencairan ke Mandor", type: "EXPENSE" },
  });
  if (!category) {
    return { error: "Kategori 'Pencairan ke Mandor' belum ada. Jalankan seed." };
  }

  if (fromGlobal) {
    const global = await getGlobalCashBalance();
    if (amount > global) {
      return {
        error: `Kas besar tidak cukup (tersedia ${formatRupiah(global)}).`,
      };
    }
  } else {
    const channel = await getChannelCashBalance(cashSourceId);
    if (amount > channel) {
      return {
        error: `Saldo sumber tidak cukup (tersedia ${formatRupiah(channel)}).`,
      };
    }
  }

  let proofUrl: string | null = null;
  try {
    proofUrl = await saveProof(formData.get("proof") as File | null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal unggah bukti." };
  }

  const last = await prisma.mandorDisbursement.findFirst({
    where: { projectId, mandorId },
    orderBy: { sequence: "desc" },
  });
  const sequence = (last?.sequence ?? 0) + 1;

  const tx = await prisma.transaction.create({
    data: {
      date,
      type: "EXPENSE",
      amount,
      description:
        description ||
        `Pencairan ${label} ke ${mandor.name}`,
      proofUrl,
      projectId,
      cashSourceId,
      categoryId: category.id,
      createdById: user.id,
      isFromGlobalCash: fromGlobal,
      isMandorDisbursement: true,
    },
  });

  await prisma.mandorDisbursement.create({
    data: {
      date,
      label,
      sequence,
      amount,
      description,
      proofUrl,
      projectId,
      mandorId,
      cashSourceId,
      transactionId: tx.id,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/mandor");
  revalidatePath("/transactions");
  return { success: "Pencairan ke Mandor dicatat." };
}
