/**
 * Self-check rumus dana Mandor (jalankan: npx tsx scripts/check-mandor-fund.ts)
 */
import {
  computeMandorFund,
  namesMatch,
} from "../lib/mandor-fund";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Bug Wonorejo: 2×50 pencairan + 50 termin nama sama ≠ 150
{
  const s = computeMandorFund({
    projectId: "p1",
    mandorId: "m1",
    disbursements: [
      { id: "d1", projectId: "p1", mandorId: "m1", amount: 50_000_000 },
      { id: "d2", projectId: "p1", mandorId: "m1", amount: 50_000_000 },
    ],
    proofs: [
      {
        amount: 46_900_000,
        projectId: "p1",
        createdById: "m1",
        linkedMandorDisbursementId: null,
        linkedContractorAdvanceId: "a1",
      },
    ],
    matchedAdvances: [{ id: "a1", amount: 50_000_000 }],
  });
  assert(s.totalCair === 100_000_000, `cair expected 100jt got ${s.totalCair}`);
  assert(s.totalBukti === 46_900_000, `bukti expected 46.9jt got ${s.totalBukti}`);
  assert(s.sisa === 53_100_000, `sisa expected 53.1jt got ${s.sisa}`);
}

// Legacy: hanya termin, tanpa pencairan Mandor
{
  const s = computeMandorFund({
    projectId: "p2",
    mandorId: "m2",
    disbursements: [],
    proofs: [
      {
        amount: 10_000_000,
        projectId: "p2",
        createdById: "m2",
        linkedMandorDisbursementId: null,
        linkedContractorAdvanceId: "a2",
      },
    ],
    matchedAdvances: [{ id: "a2", amount: 75_000_000 }],
  });
  assert(s.totalCair === 75_000_000, `legacy cair ${s.totalCair}`);
  assert(s.totalBukti === 10_000_000, `legacy bukti ${s.totalBukti}`);
  assert(s.sisa === 65_000_000, `legacy sisa ${s.sisa}`);
}

// Bukti tertaut pencairan mandor lain tidak masuk
{
  const s = computeMandorFund({
    projectId: "p3",
    mandorId: "m3",
    disbursements: [
      { id: "d3", projectId: "p3", mandorId: "m3", amount: 20_000_000 },
    ],
    proofs: [
      {
        amount: 5_000_000,
        projectId: "p3",
        createdById: "other",
        linkedMandorDisbursementId: "d-other",
        linkedContractorAdvanceId: null,
      },
    ],
    matchedAdvances: [],
  });
  assert(s.totalCair === 20_000_000, "cair m3");
  assert(s.totalBukti === 0, "bukti milik mandor lain");
}

assert(namesMatch("Bpk Feri", "Bpk Feri"), "exact");
assert(namesMatch("Bpk Feri", "Feri"), "includes");
assert(!namesMatch("Bpk Feri", "Bpk Istiadi"), "different");

console.log("OK: rumus dana Mandor lulus semua kasus.");
