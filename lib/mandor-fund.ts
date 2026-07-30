import { prisma } from "@/lib/prisma";

export type MandorFundSummary = {
  projectId: string;
  mandorId: string;
  totalCair: number;
  totalBukti: number;
  /** cair - bukti; >0 tanggungan mandor; <0 overspend */
  sisa: number;
};

function key(projectId: string, mandorId: string) {
  return `${projectId}::${mandorId}`;
}

/** Samakan "Bpk Istiadi" dengan nama user Mandor. */
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

export async function getMandorFundSummary(
  projectId: string,
  mandorId: string,
): Promise<MandorFundSummary> {
  const map = await getMandorFundSummariesFor([{ projectId, mandorId }]);
  return (
    map.get(key(projectId, mandorId)) ?? {
      projectId,
      mandorId,
      totalCair: 0,
      totalBukti: 0,
      sisa: 0,
    }
  );
}

/** Batch: pencairan MandorDisbursement + termin pemborong (nama cocok). */
export async function getMandorFundSummariesFor(
  pairs: Array<{ projectId: string; mandorId: string }>,
): Promise<Map<string, MandorFundSummary>> {
  const map = new Map<string, MandorFundSummary>();
  if (pairs.length === 0) return map;

  const projectIds = [...new Set(pairs.map((p) => p.projectId))];
  const mandorIds = [...new Set(pairs.map((p) => p.mandorId))];

  const [cairRows, buktiRows, mandors, contractors] = await Promise.all([
    prisma.mandorDisbursement.groupBy({
      by: ["projectId", "mandorId"],
      where: { projectId: { in: projectIds }, mandorId: { in: mandorIds } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["projectId", "createdById"],
      where: {
        projectId: { in: projectIds },
        createdById: { in: mandorIds },
        type: "EXPENSE",
        isMandorExpense: true,
      },
      _sum: { amount: true },
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
        advances: { select: { amount: true } },
        expenses: { select: { amount: true } },
      },
    }),
  ]);

  const cairMap = new Map(
    cairRows.map((r) => [key(r.projectId, r.mandorId), r._sum.amount ?? 0]),
  );
  const buktiMap = new Map(
    buktiRows.map((r) => [
      key(r.projectId!, r.createdById),
      r._sum.amount ?? 0,
    ]),
  );
  const nameById = new Map(mandors.map((m) => [m.id, m.name]));

  for (const p of pairs) {
    const k = key(p.projectId, p.mandorId);
    const mandorName = nameById.get(p.mandorId) ?? "";
    const contractor = contractors.find(
      (c) =>
        c.projectId === p.projectId && namesMatch(c.name, mandorName),
    );
    const fromTermin = contractor
      ? contractor.advances.reduce((s, a) => s + a.amount, 0)
      : 0;
    const fromBuktiPemborong = contractor
      ? contractor.expenses.reduce((s, e) => s + e.amount, 0)
      : 0;

    const totalCair = (cairMap.get(k) ?? 0) + fromTermin;
    const totalBukti = (buktiMap.get(k) ?? 0) + fromBuktiPemborong;
    map.set(k, {
      projectId: p.projectId,
      mandorId: p.mandorId,
      totalCair,
      totalBukti,
      sisa: totalCair - totalBukti,
    });
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
