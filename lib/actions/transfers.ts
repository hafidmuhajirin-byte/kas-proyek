"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession } from "@/lib/auth";
import {
  getChannelCashBalance,
  getGlobalCashBreakdown,
  isBankChannel,
} from "@/lib/balance";
import { formatRupiah, parseRupiahInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
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
    path.extname(file.name) ||
    (file.type === "application/pdf" ? ".pdf" : ".jpg");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

function revalidateTransferPaths() {
  revalidatePath("/transfers");
  revalidatePath("/dashboard");
  revalidatePath("/sources");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/projects");
}

export async function createCashTransferAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const dateRaw = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const fromCashSourceId = String(formData.get("fromCashSourceId") ?? "");
  const toCashSourceId = String(formData.get("toCashSourceId") ?? "");
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));

  if (!dateRaw || !description || !fromCashSourceId || !toCashSourceId) {
    return { error: "Semua field wajib diisi kecuali bukti." };
  }
  if (amount <= 0) {
    return { error: "Nominal transfer harus lebih dari 0." };
  }
  if (fromCashSourceId === toCashSourceId) {
    return { error: "Sumber asal dan tujuan tidak boleh sama." };
  }

  const [fromSource, toSource] = await Promise.all([
    prisma.cashSource.findUnique({ where: { id: fromCashSourceId } }),
    prisma.cashSource.findUnique({ where: { id: toCashSourceId } }),
  ]);
  if (!fromSource || !toSource) {
    return { error: "Sumber kas tidak ditemukan." };
  }

  const fromIsBank = isBankChannel(fromSource.type);
  const toIsBank = isBankChannel(toSource.type);
  if (fromIsBank === toIsBank) {
    return {
      error:
        "Transfer harus antar saluran berbeda: Tunai ↔ Bank (bukan sesama Tunai atau sesama Bank).",
    };
  }

  const [fromBalance, breakdown] = await Promise.all([
    getChannelCashBalance(fromCashSourceId),
    getGlobalCashBreakdown(),
  ]);

  if (amount > fromBalance) {
    const fromLabel = fromIsBank ? "Bank" : "Tunai";
    return {
      error: `${fromLabel} tidak cukup (tersedia ${formatRupiah(fromBalance)}). Tunai ${formatRupiah(breakdown.cash)} · Bank ${formatRupiah(breakdown.bank)}.`,
    };
  }

  let proofUrl: string | null = null;
  try {
    proofUrl = await saveProof(formData.get("proof") as File | null);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal upload bukti.",
    };
  }

  await prisma.cashTransfer.create({
    data: {
      date: new Date(dateRaw),
      amount,
      description,
      fromCashSourceId,
      toCashSourceId,
      createdById: session.id,
      proofUrl,
    },
  });

  revalidateTransferPaths();

  const fromLabel = fromIsBank ? "Bank" : "Tunai";
  const toLabel = toIsBank ? "Bank" : "Tunai";
  return {
    success: `Transfer ${formatRupiah(amount)} dari ${fromLabel} (${fromSource.name}) ke ${toLabel} (${toSource.name}) berhasil. Total kas besar tetap.`,
  };
}

export async function deleteCashTransferAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.cashTransfer.delete({ where: { id } });
  revalidateTransferPaths();
}
