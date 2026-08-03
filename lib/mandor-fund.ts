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

/**
 * Batch: pencairan MandorDisbursement + termin pemborong (nama cocok).
 * Bukti dihitung dari yang tertaut ke pencairan tersebut (fallback: bukti proyek mandor bila belum tertaut).
 */
export async function getMandorFundSummariesFor(
  pairs: Array<{ projectId: string; mandorId: string }>,
): Promise<Map<string, MandorFundSummary>> {
  const map = new Map<string, MandorFundSummary>();
  if (pairs.length === 0) return map;

  const projectIds = [...new Set(pairs.map((p) => p.projectId))];
  const mandorIds = [...new Set(pairs.map((p) => p.mandorId))];

  const [cairRows, disbursements, buktiRows, mandors, contractors] =
    await Promise.all([
      prisma.mandorDisbursement.groupBy({
        by: ["projectId", "mandorId"],
        where: { projectId: { in: projectIds }, mandorId: { in: mandorIds } },
        _sum: { amount: true },
      }),
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
          expenses: { select: { amount: true } },
        },
      }),
    ]);

  const cairMap = new Map(
    cairRows.map((r) => [key(r.projectId, r.mandorId), r._sum.amount ?? 0]),
  );
  const nameById = new Map(mandors.map((m) => [m.id, m.name]));

  const disbursementOwner = new Map(
    disbursements.map((d) => [d.id, key(d.projectId, d.mandorId)]),
  );

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
    const advanceIds = new Set(
      contractor?.advances.map((a) => a.id) ?? [],
    );

    const totalCair = (cairMap.get(k) ?? 0) + fromTermin;

    let totalBukti = 0;
    let hasLinked = false;
    for (const b of buktiRows) {
      if (b.projectId !== p.projectId) continue;
      if (b.linkedMandorDisbursementId) {
        const owner = disbursementOwner.get(b.linkedMandorDisbursementId);
        if (owner === k) {
          totalBukti += b.amount;
          hasLinked = true;
        }
        continue;
      }
      if (b.linkedContractorAdvanceId) {
        if (advanceIds.has(b.linkedContractorAdvanceId)) {
          totalBukti += b.amount;
          hasLinked = true;
        }
        continue;
      }
      // Fallback bukti belum tertaut: hitung ke mandor yang mengunggah
      if (!hasLinked && b.createdById === p.mandorId) {
        totalBukti += b.amount;
      }
    }

    // Jika sudah ada tautan, jangan double-count fallback; ulang hitung murni tertaut
    if (hasLinked) {
      totalBukti = 0;
      for (const b of buktiRows) {
        if (b.projectId !== p.projectId) continue;
        if (
          b.linkedMandorDisbursementId &&
          disbursementOwner.get(b.linkedMandorDisbursementId) === k
        ) {
          totalBukti += b.amount;
        } else if (
          b.linkedContractorAdvanceId &&
          advanceIds.has(b.linkedContractorAdvanceId)
        ) {
          totalBukti += b.amount;
        }
      }
    }

    // Biaya pemborong (ContractorExpense) tetap dihitung sebagai pemakaian bila ada
    const fromBuktiPemborong = contractor
      ? contractor.expenses.reduce((s, e) => s + e.amount, 0)
      : 0;
    totalBukti += fromBuktiPemborong;

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
