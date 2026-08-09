import { prisma } from "@/lib/prisma";
import {
  optionKey,
  type PencairanOption,
} from "@/lib/mandor-pencairan-shared";

export type { PencairanOption };
export {
  formatPencairanLabel,
  optionKey,
  parsePencairanKey,
} from "@/lib/mandor-pencairan-shared";

/** Daftar pencairan Mandor yang bisa ditautkan bukti (tanpa termin terpisah). */
export async function getPencairanOptionsForProject(
  projectId: string,
  opts?: { excludeProofId?: string; mandorId?: string },
): Promise<PencairanOption[]> {
  const [disbursements, proofs] = await Promise.all([
    prisma.mandorDisbursement.findMany({
      where: {
        projectId,
        transactionId: { not: null },
        ...(opts?.mandorId ? { mandorId: opts.mandorId } : {}),
      },
      orderBy: [{ date: "asc" }, { sequence: "asc" }],
      select: {
        id: true,
        date: true,
        label: true,
        amount: true,
        mandor: { select: { name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        projectId,
        isMandorExpense: true,
        linkedMandorDisbursementId: { not: null },
        // Child BKK split tidak dihitung ulang (parent/shell sudah mewakili)
        splitParentId: null,
        ...(opts?.excludeProofId ? { id: { not: opts.excludeProofId } } : {}),
      },
      select: {
        amount: true,
        linkedMandorDisbursementId: true,
      },
    }),
  ]);

  const usedByDisbursement = new Map<string, number>();
  for (const p of proofs) {
    if (p.linkedMandorDisbursementId) {
      usedByDisbursement.set(
        p.linkedMandorDisbursementId,
        (usedByDisbursement.get(p.linkedMandorDisbursementId) ?? 0) + p.amount,
      );
    }
  }

  const options: PencairanOption[] = disbursements.map((d) => {
    const used = usedByDisbursement.get(d.id) ?? 0;
    return {
      key: optionKey("disbursement", d.id),
      kind: "disbursement" as const,
      id: d.id,
      label: `${d.label} · ${d.mandor.name}`,
      amount: d.amount,
      used,
      remaining: d.amount - used,
      date: d.date,
    };
  });

  return options.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key),
  );
}

export async function getLinkedProofsForDisbursements(
  disbursementIds: string[],
) {
  if (disbursementIds.length === 0) return [];
  return prisma.transaction.findMany({
    where: {
      isMandorExpense: true,
      linkedMandorDisbursementId: { in: disbursementIds },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      proofUrl: true,
      linkedMandorDisbursementId: true,
      createdBy: { select: { name: true } },
    },
  });
}

export async function getLinkedProofsForAdvances(advanceIds: string[]) {
  if (advanceIds.length === 0) return [];
  return prisma.transaction.findMany({
    where: {
      isMandorExpense: true,
      linkedContractorAdvanceId: { in: advanceIds },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      proofUrl: true,
      linkedContractorAdvanceId: true,
      createdBy: { select: { name: true } },
    },
  });
}
