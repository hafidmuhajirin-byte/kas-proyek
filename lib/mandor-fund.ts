import { prisma } from "@/lib/prisma";
import {
  computeMandorFund,
  namesMatch,
  type MandorFundSummary,
} from "@/lib/mandor-fund-math";

export type { MandorFundSummary };
export { computeMandorFund, namesMatch } from "@/lib/mandor-fund-math";

function pairKey(projectId: string, mandorId: string) {
  return `${projectId}::${mandorId}`;
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

  const [disbursements, proofs] = await Promise.all([
    prisma.mandorDisbursement.findMany({
      where: { projectId: { in: projectIds }, mandorId: { in: mandorIds } },
      select: {
        id: true,
        projectId: true,
        mandorId: true,
        amount: true,
        transactionId: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        projectId: { in: projectIds },
        type: "EXPENSE",
        isMandorExpense: true,
        // BKK hasil split tidak dihitung — dana Mandor dari upload asli saja
        splitParentId: null,
      },
      select: {
        amount: true,
        projectId: true,
        createdById: true,
        linkedMandorDisbursementId: true,
        linkedContractorAdvanceId: true,
      },
    }),
  ]);

  for (const p of pairs) {
    const summary = computeMandorFund({
      projectId: p.projectId,
      mandorId: p.mandorId,
      disbursements,
      proofs,
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
