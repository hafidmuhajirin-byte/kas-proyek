/**
 * Rumus murni dana Mandor — tanpa DB.
 *
 * totalCair  = Σ MandorDisbursement(project, mandor) yang punya transaksi Kas Besar
 * totalBukti = Σ bukti MandorExpense milik mandor / tertaut pencairannya
 * sisa       = totalCair − totalBukti
 *
 * Termin pemborong sudah digabung ke Dana ke Mandor (tidak dicampur lagi).
 */

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
  /** Orphan tanpa transaksi Kas Besar tidak dihitung. */
  transactionId?: string | null;
};

export type MandorFundProof = {
  amount: number;
  projectId: string | null;
  createdById: string;
  linkedMandorDisbursementId: string | null;
  linkedContractorAdvanceId?: string | null;
};

/** Samakan nama (utilitas umum). */
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

export function computeMandorFund(input: {
  projectId: string;
  mandorId: string;
  disbursements: MandorFundDisbursement[];
  proofs: MandorFundProof[];
}): MandorFundSummary {
  const { projectId, mandorId } = input;
  const mine = input.disbursements.filter((d) => {
    if (d.projectId !== projectId || d.mandorId !== mandorId) return false;
    if (d.transactionId === null || d.transactionId === "") return false;
    return true;
  });
  const fromDisbursement = mine.reduce((s, d) => s + d.amount, 0);
  const myDisbursementIds = new Set(mine.map((d) => d.id));
  const totalCair = fromDisbursement;

  let totalBukti = 0;
  for (const b of input.proofs) {
    if (b.projectId !== projectId) continue;
    const linkedToMyDisbursement =
      !!b.linkedMandorDisbursementId &&
      myDisbursementIds.has(b.linkedMandorDisbursementId);
    const uploadedByMe = b.createdById === mandorId;
    if (linkedToMyDisbursement || uploadedByMe) {
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
