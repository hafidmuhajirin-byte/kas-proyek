"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  getChannelCashBalance,
  getGlobalCashBalance,
  getProjectCashBalance,
} from "@/lib/balance";
import { formatRupiah, parseRupiahInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  FEE_TRANSFER_CATEGORY,
  SCHOOL_RESIDUAL_CATEGORY,
} from "@/lib/project-completion";
import {
  fundKindFromCategoryName,
  projectFundKinds,
  type ProjectFundKind,
} from "@/lib/project-funds";
import {
  calcFeeTransferQuota,
  calcProjectProfit,
  PROJECT_FEE_PERCENT,
} from "@/lib/project-profit";
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

async function ensureFeeCategory() {
  return prisma.category.upsert({
    where: {
      name_type: { name: FEE_TRANSFER_CATEGORY, type: "EXPENSE" },
    },
    update: {},
    create: { name: FEE_TRANSFER_CATEGORY, type: "EXPENSE" },
  });
}

export async function getProjectFeeQuota(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      funds: true,
      workItems: { select: { amount: true } },
      transactions: {
        select: {
          type: true,
          amount: true,
          isOwnerPersonal: true,
          isFeeTransfer: true,
          isMandorExpense: true,
          category: { select: { name: true } },
        },
      },
      contractor: {
        include: { advances: { select: { amount: true } } },
      },
    },
  });
  if (!project) return null;

  const spentByKind: Partial<Record<ProjectFundKind, number>> = {};
  let clientIncome = 0;
  let operatingExpense = 0;
  let feeTransferred = 0;
  let ownerPersonalDraws = 0;

  for (const tx of project.transactions) {
    if (tx.type === "INCOME" && !tx.isOwnerPersonal) {
      clientIncome += tx.amount;
    }
    if (tx.type === "EXPENSE" && tx.isFeeTransfer) {
      feeTransferred += tx.amount;
    }
    if (
      tx.type === "EXPENSE" &&
      tx.isOwnerPersonal &&
      !tx.isFeeTransfer
    ) {
      ownerPersonalDraws += tx.amount;
    }
    if (
      tx.type === "EXPENSE" &&
      !tx.isOwnerPersonal &&
      !tx.isFeeTransfer &&
      !tx.isMandorExpense &&
      tx.category.name !== SCHOOL_RESIDUAL_CATEGORY
    ) {
      operatingExpense += tx.amount;
      const kind = fundKindFromCategoryName(tx.category.name);
      if (kind) spentByKind[kind] = (spentByKind[kind] ?? 0) + tx.amount;
    }
  }

  const contractorAdvances = 0; // Termin digabung ke Dana ke Mandor
  const remainingPlannedFunds = projectFundKinds.reduce((sum, kind) => {
    const planned =
      project.funds.find((f) => f.kind === kind)?.plannedAmount ?? 0;
    return sum + Math.max(0, planned - (spentByKind[kind] ?? 0));
  }, 0);
  const workCompletedValue = project.workItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  const profit = calcProjectProfit({
    contractValue: project.contractValue,
    billingMode: project.billingMode,
    workCompletedValue,
    clientIncome,
    operatingExpense,
    contractorAdvances,
    remainingPlannedFunds,
    contingencyPercent: 0,
  });

  const quota = calcFeeTransferQuota({
    feeTargetProfit: profit.feeTargetProfit,
    feeTransferred,
    ownerPersonalDraws,
  });

  return {
    projectId: project.id,
    projectName: project.name,
    status: project.status,
    feePercent: PROJECT_FEE_PERCENT,
    revenueBase: profit.revenueBase,
    ...quota,
  };
}

export async function createFeeTransferAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") ?? "");
  const dateRaw = String(formData.get("date") ?? "");
  const cashSourceId = String(formData.get("cashSourceId") ?? "");
  const destinationBank = String(formData.get("destinationBank") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));

  if (!projectId || !dateRaw || !cashSourceId || !destinationBank) {
    return {
      error: "Tanggal, sumber kas, dan rekening bank tujuan wajib diisi.",
    };
  }
  if (amount <= 0) {
    return { error: "Nominal transfer harus lebih dari 0." };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Proyek tidak ditemukan." };
  if (project.status !== "ACTIVE") {
    return {
      error:
        "Transfer fee hanya untuk proyek yang masih berjalan (status Aktif).",
    };
  }

  const quota = await getProjectFeeQuota(projectId);
  if (!quota) return { error: "Gagal menghitung kuota fee." };
  if (quota.feeTargetProfit <= 0) {
    return {
      error: `Belum ada target fee ${PROJECT_FEE_PERCENT}%. Isi nilai kontrak / nilai pekerjaan dulu.`,
    };
  }
  if (amount > quota.remaining) {
    return {
      error: `Nominal melebihi sisa kuota fee ${PROJECT_FEE_PERCENT}% (tersisa ${formatRupiah(quota.remaining)} dari target ${formatRupiah(quota.feeTargetProfit)}).`,
    };
  }

  const [projectCash, channelCash, globalCash, source] = await Promise.all([
    getProjectCashBalance(projectId),
    getChannelCashBalance(cashSourceId),
    getGlobalCashBalance(),
    prisma.cashSource.findUnique({ where: { id: cashSourceId } }),
  ]);
  if (!source) return { error: "Sumber kas tidak ditemukan." };

  if (amount > Math.max(0, projectCash)) {
    return {
      error: `Kas proyek tidak cukup (tersedia ${formatRupiah(Math.max(0, projectCash))}).`,
    };
  }
  if (amount > channelCash || amount > globalCash) {
    return {
      error: `Saldo ${source.name} / kas besar tidak cukup untuk transfer fee ${formatRupiah(amount)}.`,
    };
  }

  const category = await ensureFeeCategory();
  let proofUrl: string | null = null;
  try {
    proofUrl = await saveProof(formData.get("proof") as File | null);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal upload bukti.",
    };
  }

  const description = notes
    ? `Transfer fee ke ${destinationBank} — ${notes}`
    : `Transfer fee ke ${destinationBank}`;

  await prisma.transaction.create({
    data: {
      date: new Date(dateRaw),
      type: "EXPENSE",
      amount,
      description,
      projectId,
      cashSourceId,
      categoryId: category.id,
      createdById: session.id,
      proofUrl,
      isOwnerPersonal: true,
      isFromGlobalCash: false,
      isFeeTransfer: true,
      fundingStageId: null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {
    success: `Fee ${formatRupiah(amount)} dipindah ke bank pribadi. Sisa kuota ${formatRupiah(quota.remaining - amount)}.`,
  };
}
