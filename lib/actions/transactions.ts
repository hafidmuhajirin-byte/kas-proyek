"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertProjectAccess,
  requireOwner,
  requireSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRupiahInput, formatRupiah } from "@/lib/money";
import {
  getChannelCashBalance,
  getGlobalCashBalance,
  getGlobalCashBreakdown,
  getProjectCashBalance,
} from "@/lib/balance";
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
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

function parseTransactionFields(formData: FormData) {
  const dateRaw = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "");
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));
  const description = String(formData.get("description") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const cashSourceId = String(formData.get("cashSourceId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const fundingStageId = String(formData.get("fundingStageId") ?? "").trim();
  const isOwnerPersonal = formData.get("isOwnerPersonal") === "on";
  // Ambil pribadi owner selalu dari kas besar — bukan "masuk kas besar" proyek
  const isFromGlobalCash =
    type === "EXPENSE" &&
    !isOwnerPersonal &&
    formData.get("isFromGlobalCash") === "on";

  return {
    dateRaw,
    type,
    amount,
    description,
    projectId: projectId || null,
    cashSourceId,
    categoryId,
    fundingStageId: fundingStageId || null,
    isOwnerPersonal,
    isFromGlobalCash,
  };
}

async function validateTransactionInput(
  fields: ReturnType<typeof parseTransactionFields>,
  options?: { excludeTransactionId?: string },
) {
  if (
    !fields.dateRaw ||
    !fields.description ||
    !fields.cashSourceId ||
    !fields.categoryId
  ) {
    return "Semua field wajib diisi kecuali bukti.";
  }
  if (fields.type !== "INCOME" && fields.type !== "EXPENSE") {
    return "Jenis transaksi tidak valid.";
  }
  if (fields.amount <= 0) {
    return "Nominal harus lebih dari 0.";
  }

  // Ambil/setor pribadi owner: proyek opsional (pembukuan dana pribadi terpisah)
  if (!fields.isOwnerPersonal && !fields.projectId) {
    return "Proyek wajib dipilih untuk transaksi proyek.";
  }

  const category = await prisma.category.findUnique({
    where: { id: fields.categoryId },
  });
  if (!category) return "Kategori tidak ditemukan.";
  if (category.type !== fields.type) {
    return "Kategori tidak sesuai dengan jenis transaksi.";
  }

  if (fields.type === "EXPENSE" && fields.fundingStageId) {
    return "Tahapan dana hanya untuk pemasukan.";
  }

  if (fields.type === "INCOME" && fields.isOwnerPersonal && fields.fundingStageId) {
    return "Setoran dana pribadi tidak dihubungkan ke tahapan termin.";
  }

  if (fields.fundingStageId) {
    if (!fields.projectId) {
      return "Tahapan dana memerlukan proyek.";
    }
    const stage = await prisma.fundingStage.findUnique({
      where: { id: fields.fundingStageId },
    });
    if (!stage) return "Tahapan dana tidak ditemukan.";
    if (stage.projectId !== fields.projectId) {
      return "Tahapan dana harus milik proyek yang sama.";
    }
  }

  // Setoran dana pribadi: masuk ke kas besar, tidak dihitung sebagai pembayaran klien
  if (fields.type === "INCOME" && !fields.isOwnerPersonal) {
    const project = await prisma.project.findUnique({
      where: { id: fields.projectId! },
      select: {
        contractValue: true,
        billingMode: true,
        name: true,
      },
    });
    if (!project) return "Proyek tidak ditemukan.";

    const paidSoFar = await prisma.transaction.aggregate({
      where: {
        projectId: fields.projectId!,
        type: "INCOME",
        isOwnerPersonal: false,
        ...(options?.excludeTransactionId
          ? { NOT: { id: options.excludeTransactionId } }
          : {}),
      },
      _sum: { amount: true },
    });
    const alreadyPaid = paidSoFar._sum.amount ?? 0;
    const nextTotal = alreadyPaid + fields.amount;

    if (project.billingMode === "PAY_AT_END") {
      const work = await prisma.workItem.aggregate({
        where: { projectId: fields.projectId! },
        _sum: { amount: true },
      });
      const workValue = work._sum.amount ?? 0;
      if (workValue <= 0) {
        return "Catat pekerjaan yang sudah dikerjakan dulu. Proyek kerja-dulu tidak memakai nilai kontrak; tagihan dihitung dari pekerjaan selesai.";
      }
      if (nextTotal > workValue) {
        const remaining = Math.max(0, workValue - alreadyPaid);
        return `Pembayaran tidak boleh melebihi nilai pekerjaan selesai ${formatRupiah(workValue)}. Sudah dibayar ${formatRupiah(alreadyPaid)}. Sisa maksimal ${formatRupiah(remaining)}.`;
      }
    } else {
      if (project.contractValue <= 0) {
        return "Isi nilai kontrak proyek dulu sebelum mencatat pembayaran dari klien.";
      }
      if (nextTotal > project.contractValue) {
        const remaining = Math.max(0, project.contractValue - alreadyPaid);
        return `Total pembayaran dari klien tidak boleh melebihi nilai kontrak ${formatRupiah(project.contractValue)}. Sudah diterima ${formatRupiah(alreadyPaid)}. Sisa maksimal ${formatRupiah(remaining)}.`;
      }
    }
  }

  if (fields.type === "EXPENSE") {
    let standalone = false;
    if (fields.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: fields.projectId },
        select: { id: true, name: true, standaloneBookkeeping: true },
      });
      if (!project) return "Proyek tidak ditemukan.";
      standalone = project.standaloneBookkeeping;
      if (standalone && fields.isFromGlobalCash) {
        return "Proyek mandiri tidak bisa memakai kas besar Owner.";
      }
      if (standalone && fields.isOwnerPersonal) {
        return "Proyek mandiri tidak memakai ambil/setor pribadi Owner.";
      }
    } else if (!fields.isOwnerPersonal) {
      return "Proyek wajib dipilih.";
    }

    const source = await prisma.cashSource.findUnique({
      where: { id: fields.cashSourceId },
      select: { type: true, name: true },
    });
    if (!source) return "Sumber kas tidak ditemukan.";

    const opts = { excludeTransactionId: options?.excludeTransactionId };

    // Proyek mandiri: cek kas proyek saja (terpisah dari kas besar)
    if (standalone && fields.projectId) {
      const projectCash = await getProjectCashBalance(fields.projectId, opts);
      if (fields.amount > Math.max(0, projectCash)) {
        return `Kas proyek mandiri tidak cukup (tersedia ${formatRupiah(Math.max(0, projectCash))}).`;
      }
      return null;
    }

    const [globalCash, channelCash, breakdown] = await Promise.all([
      getGlobalCashBalance(opts),
      getChannelCashBalance(fields.cashSourceId, opts),
      getGlobalCashBreakdown(opts),
    ]);

    // Centang "masuk kas besar": hanya menggugurkan kas proyek; kas besar tetap.
    if (fields.isFromGlobalCash) {
      if (!fields.projectId) {
        return "Pengeluaran masuk kas besar memerlukan proyek.";
      }
      const projectCash = await getProjectCashBalance(fields.projectId, opts);
      const project = await prisma.project.findUnique({
        where: { id: fields.projectId },
        select: { name: true },
      });
      if (fields.amount > Math.max(0, projectCash)) {
        return `Kas proyek "${project?.name ?? ""}" tidak cukup (tersedia ${formatRupiah(Math.max(0, projectCash))}). Isi saldo proyek dulu sebelum menggugurkan ke kas besar.`;
      }
      return null;
    }

    // Ambil pribadi owner: dari kas besar, bukan pengeluaran proyek
    if (fields.isOwnerPersonal) {
      if (fields.amount > globalCash) {
        return `Kas besar tidak cukup untuk ambil pribadi (Tunai ${formatRupiah(breakdown.cash)} · Bank ${formatRupiah(breakdown.bank)}).`;
      }
      if (fields.amount > channelCash) {
        const channelLabel =
          source.type === "BANK" || source.type === "CLIENT_TRANSFER"
            ? "Bank"
            : "Tunai";
        return `${channelLabel} tidak cukup (tersedia ${formatRupiah(channelCash)} via ${source.name}).`;
      }
      return null;
    }

    if (fields.amount > globalCash) {
      return `Kas besar tidak cukup (Tunai ${formatRupiah(breakdown.cash)} · Bank ${formatRupiah(breakdown.bank)}). Wajib setor dana pribadi dulu sebelum pengeluaran ${formatRupiah(fields.amount)}.`;
    }
    if (fields.amount > channelCash) {
      const channelLabel =
        source.type === "BANK" || source.type === "CLIENT_TRANSFER"
          ? "Bank"
          : "Tunai";
      return `${channelLabel} tidak cukup (tersedia ${formatRupiah(channelCash)} via ${source.name}). Pilih sumber lain atau setor dana ke ${channelLabel.toLowerCase()} dulu.`;
    }
  }

  return null;
}

function revalidateTransactionPaths(projectId: string | null) {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createTransactionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  if (session.role === "ADMIN") {
    return { error: "AdminOK hanya dapat membaca buku kas / LPJ." };
  }
  if (session.role === "MANDOR" || session.role === "ADM_FOTO") {
    return {
      error: "Mandor mencatat belanja lewat menu Upload bukti.",
    };
  }

  const fields = parseTransactionFields(formData);

  if (session.role === "ADMIN_PROYEK") {
    if (!fields.projectId) {
      return { error: "Admin Proyek hanya mencatat transaksi proyek sendiri." };
    }
    const ok = await assertProjectAccess(session, fields.projectId);
    if (!ok) return { error: "Proyek di luar penugasan Anda." };
    const project = await prisma.project.findUnique({
      where: { id: fields.projectId },
      select: { standaloneBookkeeping: true },
    });
    if (!project?.standaloneBookkeeping) {
      return { error: "Admin Proyek hanya untuk proyek mandiri." };
    }
    if (fields.isOwnerPersonal || fields.isFromGlobalCash) {
      return { error: "Proyek mandiri tidak memakai kas besar Owner." };
    }
  }

  const error = await validateTransactionInput(fields);
  if (error) return { error };

  let proofUrl: string | null = null;
  try {
    proofUrl = await saveProof(formData.get("proof") as File | null);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal upload bukti.",
    };
  }

  await prisma.transaction.create({
    data: {
      date: new Date(fields.dateRaw),
      type: fields.type as "INCOME" | "EXPENSE",
      amount: fields.amount,
      description: fields.description,
      projectId: fields.projectId,
      cashSourceId: fields.cashSourceId,
      categoryId: fields.categoryId,
      createdById: session.id,
      proofUrl,
      fundingStageId:
        fields.type === "INCOME" && !fields.isOwnerPersonal
          ? fields.fundingStageId
          : null,
      isOwnerPersonal: fields.isOwnerPersonal,
      isFromGlobalCash:
        fields.type === "EXPENSE" ? fields.isFromGlobalCash : false,
    },
  });

  revalidateTransactionPaths(fields.projectId);
  if (session.role === "ADMIN_PROYEK") {
    redirect("/transactions/project");
  }
  redirect("/transactions");
}

export async function updateTransactionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Transaksi tidak ditemukan." };

  const fields = parseTransactionFields(formData);
  const error = await validateTransactionInput(fields, {
    excludeTransactionId: id,
  });
  if (error) return { error };

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) return { error: "Transaksi tidak ditemukan." };

  let proofUrl = existing.proofUrl;
  try {
    const uploaded = await saveProof(formData.get("proof") as File | null);
    if (uploaded) proofUrl = uploaded;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal upload bukti.",
    };
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      date: new Date(fields.dateRaw),
      type: fields.type as "INCOME" | "EXPENSE",
      amount: fields.amount,
      description: fields.description,
      projectId: fields.projectId,
      cashSourceId: fields.cashSourceId,
      categoryId: fields.categoryId,
      proofUrl,
      fundingStageId:
        fields.type === "INCOME" && !fields.isOwnerPersonal
          ? fields.fundingStageId
          : null,
      isOwnerPersonal: fields.isOwnerPersonal,
      isFromGlobalCash:
        fields.type === "EXPENSE" ? fields.isFromGlobalCash : false,
    },
  });

  revalidateTransactionPaths(fields.projectId);
  redirect("/transactions");
}

export async function deleteTransactionAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  await prisma.transaction.delete({ where: { id } });
  if (existing) revalidateTransactionPaths(existing.projectId);
}
