"use server";

import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/lib/actions/projects";
import type { SessionRole } from "@/lib/session";

function parseRole(raw: string): SessionRole | null {
  if (
    raw === "OWNER" ||
    raw === "ADMIN" ||
    raw === "MANDOR" ||
    raw === "ADM_FOTO"
  ) {
    return raw;
  }
  return null;
}

function needsProjectAssignment(role: SessionRole): boolean {
  return role === "MANDOR" || role === "ADM_FOTO";
}

function revalidateUsersAndMandor() {
  revalidatePath("/users");
  revalidatePath("/mandor");
  revalidatePath("/mandor/upload");
  revalidatePath("/mandor/lokasi");
  revalidatePath("/projects");
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
  const projectIds = [
    ...new Set(formData.getAll("projectIds").map(String).filter(Boolean)),
  ];

  if (!username || !name || !password || !role) {
    return { error: "Username, nama, password, dan role wajib diisi." };
  }
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }
  if (needsProjectAssignment(role) && projectIds.length === 0) {
    return {
      error:
        role === "ADM_FOTO"
          ? "ADM Foto wajib ditugaskan ke minimal 1 proyek."
          : "Mandor wajib ditugaskan ke minimal 1 proyek agar muncul di login Mandor.",
    };
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return { error: "Username sudah dipakai." };

  if (projectIds.length > 0) {
    const validCount = await prisma.project.count({
      where: { id: { in: projectIds } },
    });
    if (validCount !== projectIds.length) {
      return { error: "Ada proyek yang tidak valid." };
    }
  }

  const user = await prisma.user.create({
    data: {
      username,
      name,
      passwordHash: hashSync(password, 10),
      role,
    },
  });

  if (needsProjectAssignment(role) && projectIds.length > 0) {
    await prisma.projectAssignment.createMany({
      data: projectIds.map((projectId) => ({
        userId: user.id,
        projectId,
      })),
    });
  }

  revalidateUsersAndMandor();
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
  const submittedIds = [
    ...new Set(formData.getAll("projectIds").map(String).filter(Boolean)),
  ];
  /** Proyek yang tampil di form (ACTIVE + yang sudah ditugaskan). */
  const formProjectIds = [
    ...new Set(
      formData.getAll("formProjectIds").map(String).filter(Boolean),
    ),
  ];

  if (!id || !name || !role) {
    return { error: "Data pengguna tidak lengkap." };
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { projectAssignments: { select: { projectId: true } } },
  });
  if (!existing) return { error: "Pengguna tidak ditemukan." };

  let nextAssignmentIds: string[] = [];
  if (needsProjectAssignment(role)) {
    const previous = new Set(
      existing.projectAssignments.map((a) => a.projectId),
    );
    const visible = new Set(formProjectIds);
    // Pertahankan penugasan proyek yang tidak tampil di form (mis. non-ACTIVE)
    const preserved = [...previous].filter((pid) => !visible.has(pid));
    nextAssignmentIds = [...new Set([...submittedIds, ...preserved])];
    if (nextAssignmentIds.length === 0) {
      return {
        error:
          role === "ADM_FOTO"
            ? "ADM Foto wajib ditugaskan ke minimal 1 proyek. Centang proyek di bawah."
            : "Mandor wajib ditugaskan ke minimal 1 proyek. Centang proyek di bawah.",
      };
    }
  }

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
  if (needsProjectAssignment(role) && nextAssignmentIds.length > 0) {
    await prisma.projectAssignment.createMany({
      data: nextAssignmentIds.map((projectId) => ({
        userId: id,
        projectId,
      })),
    });
  }

  revalidateUsersAndMandor();
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
  revalidateUsersAndMandor();
  return {
    success: reassign
      ? "Histori dipindah ke Owner dan pengguna dihapus."
      : "Pengguna dihapus.",
  };
}
