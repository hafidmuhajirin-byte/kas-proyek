"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";

export async function createCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!name) return { error: "Nama kategori wajib diisi." };
  if (type !== "INCOME" && type !== "EXPENSE") {
    return { error: "Jenis kategori tidak valid." };
  }

  try {
    await prisma.category.create({
      data: { name, type },
    });
  } catch {
    return { error: "Kategori dengan nama dan jenis yang sama sudah ada." };
  }

  revalidatePath("/categories");
  return { success: "Kategori berhasil ditambahkan." };
}

export async function updateCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!id || !name) return { error: "Data kategori tidak lengkap." };
  if (type !== "INCOME" && type !== "EXPENSE") {
    return { error: "Jenis kategori tidak valid." };
  }

  try {
    await prisma.category.update({
      where: { id },
      data: { name, type },
    });
  } catch {
    return { error: "Gagal memperbarui kategori (mungkin nama sudah dipakai)." };
  }

  revalidatePath("/categories");
  revalidatePath("/reports");
  return { success: "Kategori berhasil diperbarui." };
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const count = await prisma.transaction.count({ where: { categoryId: id } });
  if (count > 0) {
    redirect(
      `/categories?error=${encodeURIComponent(
        "Kategori tidak bisa dihapus karena masih dipakai transaksi.",
      )}`,
    );
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/categories");
}
