import { formatRupiah } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getTaxCeilingStatus, TAX_CEILING_OF_SPK } from "@/lib/lpj/tax-compliance";
import { computeVoucherTax } from "@/lib/lpj/tax-compliance";
import type { SessionRole } from "@/lib/session";
import {
  buildInputMemory,
  checkUnitConsistency,
  type UnitConsistencyCheck,
} from "@/lib/assistant/memory";
import { filterExcludedProjects } from "@/lib/assistant/scope";

export type GuardSeverity = "warn" | "info";

export type AssistantGuard = {
  id: string;
  code:
    | "UNIT_INCONSISTENT"
    | "SPLIT_TOTAL_MISMATCH"
    | "NOTA_READY_APPROVE"
    | "TAX_OVER_SPLIT"
    | "MANDOR_NO_PROOF"
    | "MANDOR_NO_SITE_PHOTO"
    | "SPK_REMAINING"
    | "FASTER_WORKFLOW";
  severity: GuardSeverity;
  title: string;
  detail: string;
  solutions: string[];
  href?: string;
  projectId?: string;
  projectName?: string;
};

function lineSum(
  lines: Array<{ amount: number }>,
): number {
  return lines.reduce((s, l) => s + Math.round(l.amount), 0);
}

/** Build live guards for the signed-in role (AdminOK heaviest). */
export async function buildAssistantGuards(opts: {
  role: SessionRole;
  projectIds?: string[] | null;
}): Promise<AssistantGuard[]> {
  const guards: AssistantGuard[] = [];
  const role = opts.role;

  const projectWhere =
    opts.projectIds && opts.projectIds.length > 0
      ? { id: { in: opts.projectIds }, status: "ACTIVE" as const }
      : { status: "ACTIVE" as const };

  const projectsRaw = await prisma.project.findMany({
    where: projectWhere,
    select: {
      id: true,
      name: true,
      contractValue: true,
      _count: { select: { sitePhotos: true } },
      mandorDisbursements: { select: { amount: true }, take: 1 },
      transactions: {
        where: {
          type: "EXPENSE",
          isMandorExpense: true,
          isFeeTransfer: false,
        },
        select: {
          id: true,
          amount: true,
          description: true,
          breakdownStatus: true,
          isSplitParent: true,
          splitParentId: true,
          splitIndex: true,
          isAdminLpjNota: true,
          proofUrl: true,
          isMaterialAlam: true,
          category: { select: { name: true } },
          expenseLines: {
            select: { amount: true, description: true, unit: true, kind: true },
          },
        },
      },
      spkBudgetLines: { select: { amount: true } },
    },
    take: 40,
  });

  const projects = filterExcludedProjects(projectsRaw);

  let readyApproveCount = 0;
  let mismatchCount = 0;
  let largeUnsplit = 0;

  for (const project of projects) {
    const notaHref = `/admin/lpj/${project.id}/nota`;
    const childrenByParent = new Map<string, typeof project.transactions>();
    const shells = project.transactions.filter((t) => t.isSplitParent);
    for (const t of project.transactions) {
      if (t.splitParentId) {
        const list = childrenByParent.get(t.splitParentId) ?? [];
        list.push(t);
        childrenByParent.set(t.splitParentId, list);
      }
    }

    // SPLIT_TOTAL_MISMATCH — shell vs sum of children
    for (const shell of shells) {
      const kids = childrenByParent.get(shell.id) ?? [];
      if (kids.length === 0) continue;
      const sumKids = kids.reduce((s, k) => s + k.amount, 0);
      if (sumKids !== shell.amount) {
        mismatchCount += 1;
        guards.push({
          id: `split-mismatch-${shell.id}`,
          code: "SPLIT_TOTAL_MISMATCH",
          severity: "warn",
          title: "Total split ≠ nota Mandor",
          detail: `${project.name}: total BKK pecahan ${formatRupiah(sumKids)} belum sama dengan nota Mandor ${formatRupiah(shell.amount)} (selisih ${formatRupiah(Math.abs(shell.amount - sumKids))}).`,
          solutions: [
            "Koreksi nominal BKK anak atau pecah isi sampai jumlahnya pas.",
            "Split BKK tambahan lalu isi sisa selisih.",
            "Jika cabang salah, ulangi split dari nota induk.",
          ],
          href: notaHref,
          projectId: project.id,
          projectName: project.name,
        });
      }
    }

    // Per-BKK: lines total vs BKK amount + ready to approve
    const bkks = project.transactions.filter((t) => !t.isSplitParent);
    for (const bkk of bkks) {
      const sumLines = lineSum(bkk.expenseLines);
      if (bkk.expenseLines.length > 0 && sumLines !== bkk.amount) {
        mismatchCount += 1;
        guards.push({
          id: `lines-mismatch-${bkk.id}`,
          code: "SPLIT_TOTAL_MISMATCH",
          severity: "warn",
          title: "Pecah isi ≠ nominal BKK",
          detail: `${project.name}: total baris pecah ${formatRupiah(sumLines)} ≠ nominal BKK ${formatRupiah(bkk.amount)}.`,
          solutions: [
            "Sesuaikan qty/harga baris sampai total = nominal BKK.",
            "Jangan Setujui sebelum selisih nol.",
          ],
          href: notaHref,
          projectId: project.id,
          projectName: project.name,
        });
      } else if (
        bkk.expenseLines.length > 0 &&
        sumLines === bkk.amount &&
        bkk.breakdownStatus === "PENDING"
      ) {
        readyApproveCount += 1;
        guards.push({
          id: `ready-approve-${bkk.id}`,
          code: "NOTA_READY_APPROVE",
          severity: "warn",
          title: "Nota siap — wajib Setujui",
          detail: `${project.name}: pecah isi sudah pas (${formatRupiah(bkk.amount)}) tetapi masih PENDING.`,
          solutions: [
            "Buka Review Nota → Setujui (Approve) BKK ini sekarang.",
            "Batch: setujui semua BKK yang sudah pas agar tidak menumpuk.",
          ],
          href: notaHref,
          projectId: project.id,
          projectName: project.name,
        });
      }

      if (
        bkk.amount > 2_000_000 &&
        !bkk.splitParentId &&
        !bkk.isSplitParent &&
        bkk.breakdownStatus !== "APPROVED"
      ) {
        // candidate for split — count for faster tip / tax
        largeUnsplit += 1;
      }
    }

    // Tax ceiling
    let taxTotal = 0;
    for (const bkk of bkks) {
      if (bkk.breakdownStatus === "REJECTED") continue;
      const tax = computeVoucherTax({
        amount: bkk.amount,
        description: bkk.description,
        categoryName: bkk.category.name,
        isMaterialAlam: bkk.isMaterialAlam,
        isMandorExpense: true,
        breakdownStatus: bkk.breakdownStatus,
        lines: bkk.expenseLines.map((l) => ({
          amount: l.amount,
          description: l.description,
          kind: l.kind,
          isMaterialAlam: false,
        })),
      });
      taxTotal += tax.totalTax;
    }
    const ceiling = getTaxCeilingStatus(taxTotal, project.contractValue);
    if (ceiling.status === "warn" || ceiling.status === "over") {
      guards.push({
        id: `tax-${project.id}`,
        code: "TAX_OVER_SPLIT",
        severity: "warn",
        title:
          ceiling.status === "over"
            ? "Pajak melebihi plafon — split nota lagi"
            : "Pajak mendekati plafon — pertimbangkan split",
        detail: `${project.name}: pajak terkumpul ${formatRupiah(taxTotal)} dari plafon ~${formatRupiah(Math.round(project.contractValue * TAX_CEILING_OF_SPK))} (${ceiling.percentOfCeiling.toFixed(0)}%).`,
        solutions: [
          "Split nota besar (> Rp 2 jt) menjadi beberapa BKK lalu pecah isi per BKK.",
          "Cek material alam (bebas pajak) pada baris yang sesuai.",
          "Buka menu Pajak untuk pantau plafon tiap selesai 1–2 nota.",
        ],
        href: `/admin/lpj/${project.id}/pajak`,
        projectId: project.id,
        projectName: project.name,
      });
    }

    // Photos vs mandor activity
    const hasDisbursement = project.mandorDisbursements.length > 0;
    const hasMandorExpense = bkks.length > 0;
    const hasProof = bkks.some((t) => Boolean(t.proofUrl));
    if ((hasDisbursement || hasMandorExpense) && !hasProof) {
      guards.push({
        id: `no-proof-${project.id}`,
        code: "MANDOR_NO_PROOF",
        severity: "warn",
        title: "Belum ada foto bukti nota",
        detail: `${project.name}: sudah ada aktivitas Mandor/pembayaran tetapi bukti foto nota belum terlihat.`,
        solutions:
          role === "MANDOR"
            ? ["Unggah ulang bukti di menu Upload."]
            : [
                "Minta Mandor unggah ulang di menu Upload.",
                "Cek apakah nota ditolak dan belum diganti.",
              ],
        href: role === "MANDOR" ? "/mandor/upload" : notaHref,
        projectId: project.id,
        projectName: project.name,
      });
    }
    if ((hasDisbursement || hasMandorExpense) && project._count.sitePhotos === 0) {
      guards.push({
        id: `no-site-${project.id}`,
        code: "MANDOR_NO_SITE_PHOTO",
        severity: "info",
        title: "Belum ada foto pekerjaan",
        detail: `${project.name}: proyek sudah berjalan tetapi belum ada foto lokasi/pekerjaan.`,
        solutions:
          role === "MANDOR"
            ? ["Unggah foto lokasi/pekerjaan di menu Foto."]
            : ["Minta Mandor/ADM Foto unggah di Foto Proyek / lokasi."],
        href: role === "MANDOR" ? "/mandor/lokasi" : "/foto-proyek",
        projectId: project.id,
        projectName: project.name,
      });
    }

    // SPK remaining — AdminOK focus
    if (role === "ADMIN" || role === "OWNER" || role === "ADMIN_PROYEK") {
      const spkSum = project.spkBudgetLines.reduce((s, l) => s + l.amount, 0);
      const spent = bkks
        .filter((t) => t.breakdownStatus !== "REJECTED")
        .reduce((s, t) => s + t.amount, 0);
      const base = spkSum > 0 ? spkSum : project.contractValue;
      const remaining = base - spent;
      if (base > 0 && remaining >= 1_000_000 && spent > 0) {
        guards.push({
          id: `spk-rem-${project.id}`,
          code: "SPK_REMAINING",
          severity: "info",
          title: "Sisa nilai SPK belum terserap",
          detail: `${project.name}: perkiraan sisa ~${formatRupiah(remaining)} (belanja LPJ ${formatRupiah(spent)} dari acuan ${formatRupiah(base)}).`,
          solutions:
            role === "ADMIN" || role === "OWNER"
              ? [
                  "Tinjau Ringkasan SPK apakah pagu sudah lengkap.",
                  "Khusus AdminOK: pertimbangkan Tambah Nota Admin LPJ agar nilai SPK terpakai seluruhnya.",
                ]
              : ["Tinjau SPK dan belanja bersama AdminOK."],
          href: `/admin/lpj/${project.id}/spk`,
          projectId: project.id,
          projectName: project.name,
        });
      }
    }
  }

  // Faster workflow tips (AdminOK)
  if (role === "ADMIN" || role === "OWNER") {
    if (readyApproveCount >= 3) {
      guards.push({
        id: "faster-approve-batch",
        code: "FASTER_WORKFLOW",
        severity: "info",
        title: "Cara lebih cepat: batch Setujui",
        detail: `Ada ${readyApproveCount} BKK yang pecahannya sudah pas tetapi masih PENDING.`,
        solutions: [
          "Prioritaskan Setujui semua yang sudah pas sebelum pecah nota baru.",
          "Ini mempercepat LPJ dan mengurangi antrean review.",
        ],
        href: "/admin/lpj",
      });
    }
    if (largeUnsplit >= 2) {
      guards.push({
        id: "faster-split-early",
        code: "FASTER_WORKFLOW",
        severity: "info",
        title: "Cara lebih cepat: split lebih awal",
        detail: `Ada ${largeUnsplit} nota besar (> Rp 2 jt) yang belum di-split.`,
        solutions: [
          "Split dulu, baru pecah isi per BKK — lebih rapi untuk pajak dan approve.",
        ],
        href: "/admin/lpj",
      });
    }
    if (mismatchCount === 0 && readyApproveCount === 0) {
      // soft tip when idle
    }
  }

  // Cap + filter by role (info hanya sesuai login)
  const allowedCodes: AssistantGuard["code"][] | null =
    role === "OWNER" || role === "ADMIN"
      ? null
      : role === "ADMIN_PROYEK" || role === "LPJ_VIEWER"
        ? [
            "SPLIT_TOTAL_MISMATCH",
            "NOTA_READY_APPROVE",
            "TAX_OVER_SPLIT",
            "MANDOR_NO_PROOF",
            "MANDOR_NO_SITE_PHOTO",
            "UNIT_INCONSISTENT",
          ]
        : role === "MANDOR"
          ? ["MANDOR_NO_PROOF", "MANDOR_NO_SITE_PHOTO"]
          : [];

  const scoped =
    allowedCodes == null
      ? guards
      : guards.filter((g) => allowedCodes.includes(g.code));

  scoped.sort((a, b) => {
    const w = (g: AssistantGuard) => (g.severity === "warn" ? 0 : 1);
    return w(a) - w(b);
  });
  return scoped.slice(0, 40);
}

export async function checkDraftUnitAgainstMemory(opts: {
  projectId?: string;
  description: string;
  unit: string;
}): Promise<UnitConsistencyCheck | null> {
  const memory = await buildInputMemory(opts.projectId);
  return checkUnitConsistency(memory, opts.description, opts.unit);
}

export function guardToAssistantText(g: AssistantGuard): {
  text: string;
  solutions: string[];
  href?: string;
} {
  return {
    text: `${g.title}\n${g.detail}`,
    solutions: g.solutions,
    href: g.href,
  };
}
