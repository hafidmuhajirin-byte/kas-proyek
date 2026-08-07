"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession } from "@/lib/auth";
import { CONTRACTOR_MAX_SAFE_PERCENT, calcContractorBudgetAmount } from "@/lib/contractor";
import { findMandorByName } from "@/lib/mandor-assign";
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

function revalidateContractor(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/transactions");
}

export async function upsertContractorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const agreedAmount = parseRupiahInput(
    String(formData.get("agreedAmount") ?? "0"),
  );

  if (!projectId || !name) {
    return { error: "Nama pemborong wajib diisi." };
  }
  if (agreedAmount < 0) {
    return { error: "Nilai borongan tidak valid." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { contractValue: true },
  });
  if (!project) return { error: "Proyek tidak ditemukan." };

  if (project.contractValue > 0 && agreedAmount > 0) {
    const maxSafe = calcContractorBudgetAmount(
      project.contractValue,
      CONTRACTOR_MAX_SAFE_PERCENT,
    );
    if (agreedAmount > maxSafe) {
      return {
        error: `Nilai borongan melebihi batas aman ${CONTRACTOR_MAX_SAFE_PERCENT}% kontrak (${formatRupiah(maxSafe)}). Target ideal 70% agar keuangan aman.`,
      };
    }
  }

  const existing = await prisma.contractor.findUnique({
    where: { projectId },
    select: { id: true },
  });
  const paidAgg = await prisma.mandorDisbursement.aggregate({
    where: { projectId, transactionId: { not: null } },
    _sum: { amount: true },
  });
  const alreadyPaid = paidAgg._sum.amount ?? 0;
  if (agreedAmount > 0 && agreedAmount < alreadyPaid) {
    return {
      error: `Nilai borongan tidak boleh lebih kecil dari total Dana ke Mandor yang sudah diberikan (${formatRupiah(alreadyPaid)}).`,
    };
  }

  await prisma.contractor.upsert({
    where: { projectId },
    create: {
      projectId,
      name,
      phone,
      notes,
      agreedAmount,
    },
    update: {
      name,
      phone,
      notes,
      agreedAmount,
    },
  });

  // Jika nama pemborong cocok akun Mandor → otomatis tugaskan ke proyek
  // agar proyek muncul di login Mandor (bukan hanya data pemborong).
  const mandors = await prisma.user.findMany({
    where: { role: "MANDOR" },
    select: { id: true, name: true, username: true },
  });
  const matched = findMandorByName(mandors, name);
  let assignNote = "";
  if (matched) {
    await prisma.projectAssignment.upsert({
      where: {
        userId_projectId: { userId: matched.id, projectId },
      },
      create: { userId: matched.id, projectId },
      update: {},
    });
    assignNote = ` Mandor ${matched.name} otomatis ditugaskan ke proyek.`;
    revalidatePath("/mandor");
    revalidatePath("/mandor/upload");
    revalidatePath("/users");
  }

  revalidateContractor(projectId);
  return {
    success: `Data pemborong disimpan.${assignNote}`,
  };
}

export async function createContractorAdvanceAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireSession();
  return {
    error:
      "Termin digabung ke Dana ke Mandor. Catat pencairan di panel Dana ke Mandor.",
  };
}

export async function deleteContractorAdvanceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const advance = await prisma.contractorAdvance.findUnique({
    where: { id },
    include: { contractor: { select: { projectId: true } } },
  });
  if (!advance) return;

  await prisma.contractorAdvance.delete({ where: { id } });
  revalidateContractor(advance.contractor.projectId);
}

export async function createContractorExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const projectId = String(formData.get("projectId") ?? "");
  const dateRaw = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const kind = String(formData.get("kind") ?? "OTHER");
  const amount = parseRupiahInput(String(formData.get("amount") ?? "0"));

  if (!projectId || !dateRaw || !description) {
    return { error: "Semua field wajib diisi kecuali bukti." };
  }
  if (amount <= 0) {
    return { error: "Nominal bukti harus lebih dari 0." };
  }
  if (kind !== "MATERIAL" && kind !== "WAGES" && kind !== "OTHER") {
    return { error: "Jenis bukti tidak valid." };
  }

  const contractor = await prisma.contractor.findUnique({
    where: { projectId },
    include: {
      expenses: { select: { amount: true } },
    },
  });
  if (!contractor) {
    return { error: "Isi data pemborong & nilai borongan dulu." };
  }

  const totalExpenses =
    contractor.expenses.reduce((sum, e) => sum + e.amount, 0) + amount;
  if (totalExpenses > contractor.agreedAmount) {
    return {
      error: `Total bukti tidak boleh melebihi nilai borongan ${formatRupiah(contractor.agreedAmount)}.`,
    };
  }

  const mandorPaid = await prisma.mandorDisbursement.aggregate({
    where: { projectId, transactionId: { not: null } },
    _sum: { amount: true },
  });
  const totalPaid = mandorPaid._sum.amount ?? 0;

  let proofUrl: string | null = null;
  try {
    proofUrl = await saveProof(formData.get("proof") as File | null);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal upload bukti.",
    };
  }

  await prisma.contractorExpense.create({
    data: {
      contractorId: contractor.id,
      date: new Date(dateRaw),
      amount,
      kind,
      description,
      proofUrl,
    },
  });

  revalidateContractor(projectId);

  const shortfall = Math.max(0, totalExpenses - totalPaid);
  if (shortfall > 0) {
    return {
      success: `Bukti tersimpan. Total bukti melebihi dana cair — perlu pencairan Mandor ${formatRupiah(shortfall)}.`,
    };
  }
  return { success: "Bukti pengeluaran pemborong tersimpan." };
}

export async function deleteContractorExpenseAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const expense = await prisma.contractorExpense.findUnique({
    where: { id },
    include: { contractor: { select: { projectId: true } } },
  });
  if (!expense) return;

  await prisma.contractorExpense.delete({ where: { id } });
  revalidateContractor(expense.contractor.projectId);
}
