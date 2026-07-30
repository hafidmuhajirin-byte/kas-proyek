"use server";

import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";
import type { SessionRole } from "@/lib/session";

function parseRole(raw: string): SessionRole | null {
  if (raw === "OWNER" || raw === "ADMIN" || raw === "MANDOR") return raw;
  return null;
}

export async function createUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(String(formData.get("role") ?? ""));
  const projectIds = formData.getAll("projectIds").map(String).filter(Boolean);

  if (!username || !name || !password || !role) {
    return { error: "Username, nama, password, dan role wajib diisi." };
  }
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return { error: "Username sudah dipakai." };

  const user = await prisma.user.create({
    data: {
      username,
      name,
      passwordHash: hashSync(password, 10),
      role,
    },
  });

  if (role === "MANDOR" && projectIds.length > 0) {
    await prisma.projectAssignment.createMany({
      data: projectIds.map((projectId) => ({
        userId: user.id,
        projectId,
      })),
    });
  }

  revalidatePath("/users");
  return { success: "Pengguna ditambahkan." };
}

export async function updateUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = parseRole(String(formData.get("role") ?? ""));
  const password = String(formData.get("password") ?? "");
  const projectIds = formData.getAll("projectIds").map(String).filter(Boolean);

  if (!id || !name || !role) {
    return { error: "Data pengguna tidak lengkap." };
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { error: "Pengguna tidak ditemukan." };

  await prisma.user.update({
    where: { id },
    data: {
      name,
      role,
      ...(password.length >= 6
        ? { passwordHash: hashSync(password, 10) }
        : {}),
    },
  });

  await prisma.projectAssignment.deleteMany({ where: { userId: id } });
  if (role === "MANDOR" && projectIds.length > 0) {
    await prisma.projectAssignment.createMany({
      data: projectIds.map((projectId) => ({
        userId: id,
        projectId,
      })),
    });
  }

  revalidatePath("/users");
  return { success: "Pengguna diperbarui." };
}

export async function deleteUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const id = String(formData.get("id") ?? "");
  const reassign = formData.get("reassign") === "1";
  if (!id) return { error: "Pengguna tidak ditemukan." };

  if (id === session.id) {
    return {
      error:
        "Tidak bisa menghapus akun yang sedang Anda pakai. Login dengan Owner lain dulu.",
    };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "Pengguna tidak ditemukan." };

  if (target.role === "OWNER") {
    const ownerCount = await prisma.user.count({ where: { role: "OWNER" } });
    if (ownerCount <= 1) {
      return { error: "Tidak bisa menghapus Owner terakhir di sistem." };
    }
  }

  const [txCount, transferCount, disbursementCount] = await Promise.all([
    prisma.transaction.count({ where: { createdById: id } }),
    prisma.cashTransfer.count({ where: { createdById: id } }),
    prisma.mandorDisbursement.count({ where: { mandorId: id } }),
  ]);

  if (disbursementCount > 0) {
    return {
      error: `Tidak bisa dihapus: masih ada ${disbursementCount} pencairan Mandor atas nama akun ini.`,
    };
  }

  if (txCount + transferCount > 0 && !reassign) {
    return {
      error: `Akun @${target.username} masih punya ${txCount} transaksi dan ${transferCount} transfer. Centang "Pindahkan histori ke Owner lalu hapus" di bawah tombol Hapus.`,
    };
  }

  if (reassign && txCount + transferCount > 0) {
    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { createdById: id },
        data: { createdById: session.id },
      }),
      prisma.cashTransfer.updateMany({
        where: { createdById: id },
        data: { createdById: session.id },
      }),
    ]);
  }

  await prisma.projectAssignment.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
  revalidatePath("/users");
  return {
    success: reassign
      ? "Histori dipindah ke Owner dan pengguna dihapus."
      : "Pengguna dihapus.",
  };
}
