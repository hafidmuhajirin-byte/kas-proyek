/**
 * Rumus murni dana Mandor — tanpa DB.
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
