import { prisma } from "@/lib/prisma";

export type MandorFundSummary = {
  projectId: string;
  mandorId: string;
  totalCair: number;
  totalBukti: number;
  /** cair − bukti; >0 tanggungan upload; <0 overspend */
  sisa: number;
};

export type MandorFundDisbursement = {
  id: string;
  projectId: string;
  mandorId: string;
  amount: number;
};

export type MandorFundProof = {
  amount: number;
  projectId: string | null;
  createdById: string;
  linkedMandorDisbursementId: string | null;
  linkedContractorAdvanceId: string | null;
};

export type MandorFundAdvance = {
  id: string;
  amount: number;
};

function pairKey(projectId: string, mandorId: string) {
  return `${projectId}::${mandorId}`;
}

/** Samakan nama untuk fallback legacy saja (bukan untuk mencampur dua saluran aktif). */
export function namesMatch(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const x = n(a);
  const y = n(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * Rumus andal dana Mandor (satu saluran, tanpa double-count):
 *
 * totalCair =
 *   Σ MandorDisbursement(project, mandor)
 *   + Σ termin pemborong (nama cocok) HANYA jika belum ada pencairan Mandor
 *     → mencegah 50+50 pencairan + 50 termin = 150
 *
 * totalBukti =
 *   Σ bukti MandorExpense unik yang:
 *     • tertaut ke pencairan Mandor milik mandor ini, ATAU
 *     • diunggah mandor ini (termasuk yang tertaut termin), ATAU
 *     • tertaut ke termin yang ikut dihitung di totalCair (mode legacy)
 *
 * sisa = totalCair − totalBukti
 *
 * Tidak memakai ContractorExpense (buku pemborong terpisah).
 * Tidak menjumlahkan Transaction isMandorDisbursement (sudah diwakili MandorDisbursement).
 */
export function computeMandorFund(input: {
  projectId: string;
  mandorId: string;
  disbursements: MandorFundDisbursement[];
  proofs: MandorFundProof[];
  /** Termin pemborong bila nama cocok; kosongkan jika tidak relevan. */
  matchedAdvances?: MandorFundAdvance[];
}): MandorFundSummary {
  const { projectId, mandorId } = input;
  const mine = input.disbursements.filter(
    (d) => d.projectId === projectId && d.mandorId === mandorId,
  );
  const fromDisbursement = mine.reduce((s, d) => s + d.amount, 0);
  const myDisbursementIds = new Set(mine.map((d) => d.id));

  const advances = input.matchedAdvances ?? [];
  // Jangan campur termin ke pencairan Mandor yang sudah ada (akar bug 100+50=150).
  const includeTerminLegacy = fromDisbursement <= 0 && advances.length > 0;
  const fromTermin = includeTerminLegacy
    ? advances.reduce((s, a) => s + a.amount, 0)
    : 0;
  const advanceIds = includeTerminLegacy
    ? new Set(advances.map((a) => a.id))
    : new Set<string>();

  const totalCair = fromDisbursement + fromTermin;

  let totalBukti = 0;
  for (const b of input.proofs) {
    if (b.projectId !== projectId) continue;

    const linkedToMyDisbursement =
      !!b.linkedMandorDisbursementId &&
      myDisbursementIds.has(b.linkedMandorDisbursementId);

    const uploadedByMe = b.createdById === mandorId;

    const linkedToLegacyTermin =
      includeTerminLegacy &&
      !!b.linkedContractorAdvanceId &&
      advanceIds.has(b.linkedContractorAdvanceId);

    if (linkedToMyDisbursement || uploadedByMe || linkedToLegacyTermin) {
      totalBukti += b.amount;
    }
  }

  return {
    projectId,
    mandorId,
    totalCair,
    totalBukti,
    sisa: totalCair - totalBukti,
  };
}

export async function getMandorFundSummary(
  projectId: string,
  mandorId: string,
): Promise<MandorFundSummary> {
  const map = await getMandorFundSummariesFor([{ projectId, mandorId }]);
  return (
    map.get(pairKey(projectId, mandorId)) ?? {
      projectId,
      mandorId,
      totalCair: 0,
      totalBukti: 0,
      sisa: 0,
    }
  );
}

/** Batch ringkasan dana Mandor per pasangan proyek–mandor. */
export async function getMandorFundSummariesFor(
  pairs: Array<{ projectId: string; mandorId: string }>,
): Promise<Map<string, MandorFundSummary>> {
  const map = new Map<string, MandorFundSummary>();
  if (pairs.length === 0) return map;

  const projectIds = [...new Set(pairs.map((p) => p.projectId))];
  const mandorIds = [...new Set(pairs.map((p) => p.mandorId))];

  const [disbursements, proofs, mandors, contractors] = await Promise.all([
    prisma.mandorDisbursement.findMany({
      where: { projectId: { in: projectIds }, mandorId: { in: mandorIds } },
      select: { id: true, projectId: true, mandorId: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: {
        projectId: { in: projectIds },
        type: "EXPENSE",
        isMandorExpense: true,
      },
      select: {
        amount: true,
        projectId: true,
        createdById: true,
        linkedMandorDisbursementId: true,
        linkedContractorAdvanceId: true,
      },
    }),
    prisma.user.findMany({
      where: { id: { in: mandorIds } },
      select: { id: true, name: true },
    }),
    prisma.contractor.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        projectId: true,
        name: true,
        advances: { select: { id: true, amount: true } },
      },
    }),
  ]);

  const nameById = new Map(mandors.map((m) => [m.id, m.name]));

  for (const p of pairs) {
    const mandorName = nameById.get(p.mandorId) ?? "";
    const contractor = contractors.find(
      (c) =>
        c.projectId === p.projectId && namesMatch(c.name, mandorName),
    );

    const summary = computeMandorFund({
      projectId: p.projectId,
      mandorId: p.mandorId,
      disbursements,
      proofs,
      matchedAdvances: contractor?.advances,
    });
    map.set(pairKey(p.projectId, p.mandorId), summary);
  }

  return map;
}

export async function getOverspendAlarms() {
  const assignments = await prisma.projectAssignment.findMany({
    where: { user: { role: "MANDOR" } },
    select: { projectId: true, userId: true },
  });

  const summaries = await getMandorFundSummariesFor(
    assignments.map((a) => ({
      projectId: a.projectId,
      mandorId: a.userId,
    })),
  );

  const overspendPairs = [...summaries.values()].filter((s) => s.sisa < 0);
  if (overspendPairs.length === 0) return [];

  const projectIds = [...new Set(overspendPairs.map((p) => p.projectId))];
  const mandorIds = [...new Set(overspendPairs.map((p) => p.mandorId))];

  const [projects, mandors] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { id: { in: mandorIds } },
      select: { id: true, name: true },
    }),
  ]);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const mandorName = new Map(mandors.map((m) => [m.id, m.name]));

  return overspendPairs.map((p) => ({
    projectId: p.projectId,
    projectName: projectName.get(p.projectId) ?? "Proyek",
    mandorId: p.mandorId,
    mandorName: mandorName.get(p.mandorId) ?? "Mandor",
    totalCair: p.totalCair,
    totalBukti: p.totalBukti,
    overspend: -p.sisa,
  }));
}
