"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

const sourceTypes = ["BANK", "CASH", "CLIENT_TRANSFER", "OTHER"] as const;

function parseAccountNumber(formData: FormData, type: string) {
  const raw = String(formData.get("accountNumber") ?? "").trim();
  if (!raw) return null;
  // Simpan nomor rekening hanya relevan untuk bank / transfer
  if (type !== "BANK" && type !== "CLIENT_TRANSFER") return null;
  return raw.replace(/\s+/g, "");
}

export async function createCashSourceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "OTHER");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const accountNumber = parseAccountNumber(formData, type);

  if (!name) return { error: "Nama sumber kas wajib diisi." };
  if (!sourceTypes.includes(type as (typeof sourceTypes)[number])) {
    return { error: "Jenis sumber kas tidak valid." };
  }
  if (
    (type === "BANK" || type === "CLIENT_TRANSFER") &&
    accountNumber &&
    accountNumber.length < 5
  ) {
    return { error: "Nomor rekening terlalu pendek." };
  }

  await prisma.cashSource.create({
    data: {
      name,
      type: type as (typeof sourceTypes)[number],
      accountNumber,
      notes,
    },
  });
  revalidatePath("/sources");
  revalidatePath("/transfers");
  return { success: "Sumber kas berhasil ditambahkan." };
}

export async function updateCashSourceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "OTHER");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const accountNumber = parseAccountNumber(formData, type);

  if (!id || !name) return { error: "Data sumber kas tidak lengkap." };
  if (!sourceTypes.includes(type as (typeof sourceTypes)[number])) {
    return { error: "Jenis sumber kas tidak valid." };
  }
  if (
    (type === "BANK" || type === "CLIENT_TRANSFER") &&
    accountNumber &&
    accountNumber.length < 5
  ) {
    return { error: "Nomor rekening terlalu pendek." };
  }

  await prisma.cashSource.update({
    where: { id },
    data: {
      name,
      type: type as (typeof sourceTypes)[number],
      accountNumber,
      notes,
    },
  });
  revalidatePath("/sources");
  revalidatePath("/transfers");
  revalidatePath("/reports");
  return { success: "Sumber kas berhasil diperbarui." };
}

export async function deleteCashSourceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [txCount, advanceCount, transferCount] = await Promise.all([
    prisma.transaction.count({ where: { cashSourceId: id } }),
    prisma.contractorAdvance.count({ where: { cashSourceId: id } }),
    prisma.cashTransfer.count({
      where: {
        OR: [{ fromCashSourceId: id }, { toCashSourceId: id }],
      },
    }),
  ]);
  if (txCount > 0 || advanceCount > 0 || transferCount > 0) {
    redirect(
      `/sources?error=${encodeURIComponent(
        "Sumber kas tidak bisa dihapus karena masih dipakai transaksi/transfer.",
      )}`,
    );
  }

  await prisma.cashSource.delete({ where: { id } });
  revalidatePath("/sources");
  revalidatePath("/transfers");
}
