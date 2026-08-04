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

/** Daftar pencairan yang bisa ditautkan bukti Mandor untuk satu proyek. */
export async function getPencairanOptionsForProject(
  projectId: string,
  opts?: { excludeProofId?: string },
): Promise<PencairanOption[]> {
  const [disbursements, advances, proofs] = await Promise.all([
    prisma.mandorDisbursement.findMany({
      where: { projectId },
      orderBy: [{ date: "asc" }, { sequence: "asc" }],
      select: {
        id: true,
        date: true,
        label: true,
        amount: true,
        transactionId: true,
        mandor: { select: { name: true } },
      },
    }),
    prisma.contractorAdvance.findMany({
      where: { contractor: { projectId } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        amount: true,
        description: true,
        contractor: { select: { name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        projectId,
        isMandorExpense: true,
        ...(opts?.excludeProofId ? { id: { not: opts.excludeProofId } } : {}),
        OR: [
          { linkedMandorDisbursementId: { not: null } },
          { linkedContractorAdvanceId: { not: null } },
        ],
      },
      select: {
        amount: true,
        linkedMandorDisbursementId: true,
        linkedContractorAdvanceId: true,
      },
    }),
  ]);

  const usedByDisbursement = new Map<string, number>();
  const usedByAdvance = new Map<string, number>();
  for (const p of proofs) {
    if (p.linkedMandorDisbursementId) {
      usedByDisbursement.set(
        p.linkedMandorDisbursementId,
        (usedByDisbursement.get(p.linkedMandorDisbursementId) ?? 0) + p.amount,
      );
    }
    if (p.linkedContractorAdvanceId) {
      usedByAdvance.set(
        p.linkedContractorAdvanceId,
        (usedByAdvance.get(p.linkedContractorAdvanceId) ?? 0) + p.amount,
      );
    }
  }

  const options: PencairanOption[] = [
    ...disbursements
      .filter((d) => Boolean(d.transactionId))
      .map((d) => {
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
    }),
    ...advances.map((a) => {
      const used = usedByAdvance.get(a.id) ?? 0;
      return {
        key: optionKey("advance", a.id),
        kind: "advance" as const,
        id: a.id,
        label: `Termin ${a.contractor.name} — ${a.description}`,
        amount: a.amount,
        used,
        remaining: a.amount - used,
        date: a.date,
      };
    }),
  ];

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
