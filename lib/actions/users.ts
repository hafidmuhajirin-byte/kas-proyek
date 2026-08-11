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
    raw === "ADMIN_PROYEK" ||
    raw === "LPJ_VIEWER" ||
    raw === "MANDOR" ||
    raw === "ADM_FOTO"
  ) {
    return raw;
  }
  return null;
}

function needsProjectAssignment(role: SessionRole): boolean {
  return (
    role === "MANDOR" ||
    role === "ADM_FOTO" ||
    role === "ADMIN_PROYEK" ||
    role === "LPJ_VIEWER"
  );
}

function assignmentError(role: SessionRole): string {
  if (role === "ADM_FOTO") {
    return "ADM Foto wajib ditugaskan ke minimal 1 proyek.";
  }
  if (role === "ADMIN_PROYEK") {
    return "Admin Proyek wajib ditugaskan ke tepat 1 proyek mandiri.";
  }
  if (role === "LPJ_VIEWER") {
    return "LPJ Proyek wajib ditugaskan ke tepat 1 proyek.";
  }
  return "Mandor wajib ditugaskan ke minimal 1 proyek agar muncul di login Mandor.";
}

function revalidateUsersAndMandor() {
  revalidatePath("/users");
  revalidatePath("/mandor");
  revalidatePath("/mandor/upload");
  revalidatePath("/mandor/lokasi");
  revalidatePath("/projects");
  revalidatePath("/admin-proyek");
}

async function validateAdminProyekProjects(
  projectIds: string[],
): Promise<string | null> {
  if (projectIds.length !== 1) {
    return "Admin Proyek wajib ditugaskan ke tepat 1 proyek mandiri.";
  }
  const project = await prisma.project.findUnique({
    where: { id: projectIds[0]! },
    select: { standaloneBookkeeping: true, name: true },
  });
  if (!project) return "Proyek tidak valid.";
  if (!project.standaloneBookkeeping) {
    return `Admin Proyek hanya untuk proyek mandiri. "${project.name}" masih terhubung kas besar.`;
  }
  const taken = await prisma.projectAssignment.findFirst({
    where: {
      projectId: projectIds[0]!,
      user: { role: "ADMIN_PROYEK" },
    },
    select: { user: { select: { username: true } } },
  });
  // allow same user on update — caller checks
  if (taken) {
    return `Proyek ini sudah punya Admin Proyek (@${taken.user.username}).`;
  }
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
    return { error: assignmentError(role) };
  }
  if (role === "ADMIN_PROYEK") {
    const err = await validateAdminProyekProjects(projectIds);
    if (err) return { error: err };
  } else if (role === "LPJ_VIEWER" && projectIds.length !== 1) {
    return { error: "LPJ Proyek wajib ditugaskan ke tepat 1 proyek." };
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
    const preserved = [...previous].filter((pid) => !visible.has(pid));
    nextAssignmentIds = [...new Set([...submittedIds, ...preserved])];
    if (nextAssignmentIds.length === 0) {
      return { error: assignmentError(role) };
    }
    if (role === "ADMIN_PROYEK") {
      if (nextAssignmentIds.length !== 1) {
        return {
          error: "Admin Proyek wajib ditugaskan ke tepat 1 proyek mandiri.",
        };
      }
      const project = await prisma.project.findUnique({
        where: { id: nextAssignmentIds[0]! },
        select: { standaloneBookkeeping: true, name: true },
      });
      if (!project?.standaloneBookkeeping) {
        return {
          error: `Admin Proyek hanya untuk proyek mandiri. "${project?.name ?? ""}" masih terhubung kas besar.`,
        };
      }
      const taken = await prisma.projectAssignment.findFirst({
        where: {
          projectId: nextAssignmentIds[0]!,
          user: { role: "ADMIN_PROYEK", NOT: { id } },
        },
        select: { user: { select: { username: true } } },
      });
      if (taken) {
        return {
          error: `Proyek ini sudah punya Admin Proyek (@${taken.user.username}).`,
        };
      }
    } else if (role === "LPJ_VIEWER" && nextAssignmentIds.length !== 1) {
      return {
        error: "LPJ Proyek wajib ditugaskan ke tepat 1 proyek.",
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
